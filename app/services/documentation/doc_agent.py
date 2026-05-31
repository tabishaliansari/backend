"""
Documentation Agent runner using the OpenAI Agents SDK.

Single responsibility: given a DocumentationAgentContext and config, run the
documentation agent and return the generated markdown + sections metadata.

Mirrors the structure of services/agents/chat_agent.py:
  - _build_doc_system_prompt() builds static instructions
  - generate_docs_with_agent()  creates Agent + Runner, returns final output

Model selection:
  - "o1-mini":     Reasoning model (o1-mini). Better analysis, slower, more expensive.
                   Requires temperature=1 (do NOT lower it).
  - "gpt-4o-mini": Standard model. Faster, cheaper, still capable for smaller repos.
"""

import re
import time
from typing import Optional

from agents import Agent, Runner

from app.utils.logger import logger
from app.services.documentation.agent_tools import (
    DocumentationAgentContext,
    extract_entities,
    get_architecture_overview,
    get_code_examples,
    doc_vector_search,
    doc_graph_search,
)


# ─────────────────────────────────────────────────────────────────────────
# Prompt builders
# ─────────────────────────────────────────────────────────────────────────

def _build_doc_system_prompt(config: dict) -> str:
    """
    Build the system prompt for the documentation agent.
    Injects style and detail-level instructions from the generation config.
    """
    style       = config.get("style", "technical")
    detail      = config.get("detail_level", "comprehensive")
    inc_apis    = config.get("include_apis", True)
    inc_examples= config.get("include_examples", True)
    inc_arch    = config.get("include_architecture_diagram", True)

    # ── Style instructions ────────────────────────────────────────────────
    style_instructions = {
        "technical": (
            "Write for experienced software engineers. Use precise technical language. "
            "Include implementation details, design patterns, and architectural decisions. "
            "Assume the reader is comfortable reading code."
        ),
        "beginner-friendly": (
            "Write for developers new to this codebase or technology. "
            "Explain concepts clearly without assuming prior knowledge. "
            "Use analogies and plain language where possible. "
            "Include step-by-step instructions for common tasks."
        ),
        "executive": (
            "Write for non-technical stakeholders. Focus on what the system does, "
            "its business value, and high-level capabilities. "
            "Avoid low-level implementation details. "
            "Use bullet points and summaries over long paragraphs."
        ),
    }.get(style, "Write in a clear, professional technical style.")

    # ── Detail level instructions ─────────────────────────────────────────
    detail_instructions = {
        "minimal": (
            "Be concise. Cover only the most important concepts. "
            "Aim for a documentation length of 500–1500 words."
        ),
        "medium": (
            "Provide moderate depth. Cover all major components but skip edge cases. "
            "Aim for 1500–4000 words."
        ),
        "comprehensive": (
            "Be thorough and detailed. Cover all significant components, patterns, "
            "configuration options, and usage scenarios. "
            "Aim for 3000–8000 words."
        ),
    }.get(detail, "Provide comprehensive, thorough documentation.")

    # ── Optional section flags ────────────────────────────────────────────
    optional_sections = []
    if inc_arch:
        optional_sections.append(
            "- **Architecture & Design**: Include a clear description of the system architecture, "
            "layers, and how major components interact."
        )
    if inc_apis:
        optional_sections.append(
            "- **API Reference**: Document all public APIs, functions, classes, "
            "and their parameters/return values."
        )
    if inc_examples:
        optional_sections.append(
            "- **Usage Examples**: Include real, runnable code examples from the repository."
        )
    optional_section_text = "\n".join(optional_sections) if optional_sections else ""

    return f"""\
You are an expert technical documentation writer with deep software engineering expertise.
Your task is to generate complete, high-quality documentation for a GitHub repository.

━━━ DOCUMENTATION STYLE ━━━

{style_instructions}

━━━ DETAIL LEVEL ━━━

{detail_instructions}

━━━ REQUIRED SECTIONS ━━━

Your documentation MUST include ALL of the following sections (use ## headings):

## Overview
Brief description of what this repository does, its purpose, and who it is for.

## Getting Started
Installation, dependencies, and quickstart instructions.

## Project Structure
Directory layout and explanation of major directories/files.
{optional_section_text}

## Configuration
Configuration options, environment variables, and settings.

## Contributing
How to contribute to the project (if relevant information exists in the repository).

━━━ TOOLS ━━━

You have 5 tools to gather information about the repository. Use them strategically:

extract_entities
  Use FIRST to understand what types of code exist (classes, functions, modules).
  Call with no entity_type to get the full distribution, then call again for specific types.

get_architecture_overview
  Use to understand how modules and components connect.
  Essential for writing the Architecture section.

get_code_examples
  Use to find real code from the repository to illustrate concepts.
  Pass specific topics like "authentication", "database queries", "API endpoints".

doc_vector_search
  Use to find README content, setup instructions, inline documentation, config files.
  Pass natural language queries.

doc_graph_search
  Use to look up a specific class, function, or module and see its relationships.
  Pass entity names, not questions.

━━━ WORKFLOW ━━━

1. Call extract_entities to understand the codebase structure
2. Call get_architecture_overview to understand system design
3. Call doc_vector_search for "README installation setup" to find getting started info
4. Call get_code_examples for key topics relevant to this codebase
5. Call doc_graph_search for specific important entities you discover
6. Synthesize all gathered information into complete, well-structured markdown

━━━ OUTPUT FORMAT ━━━

- Output ONLY the markdown documentation — no preamble, no "here is the documentation"
- Start directly with: # [Repository Name] Documentation
- Use proper markdown: ## for sections, ### for subsections, code blocks for code
- Make it production-ready: something you would be proud to publish on GitHub
- Do NOT hallucinate features or code that does not exist in the repository
- If information is not available via tools, state that clearly rather than guessing
"""


def _build_doc_user_prompt(config: dict) -> str:
    """Build the user-turn message that kicks off documentation generation."""
    style  = config.get("style", "technical")
    detail = config.get("detail_level", "comprehensive")
    model  = config.get("model", "gpt-4o-mini")
    return (
        f"Generate complete {detail} {style} documentation for this GitHub repository. "
        f"Use all available tools to gather accurate information before writing. "
        f"The documentation should be ready to publish immediately."
    )


# ─────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────

async def generate_docs_with_agent(
    source_id: str,
    collection_name: str,
    config: dict,
    user_id: str,
    doc_gen_id: str,
) -> tuple[str, dict]:
    """
    Run the documentation agent and return (markdown, sections_metadata).

    Args:
        source_id:       GitHub source UUID string (Neo4j scope key)
        collection_name: Qdrant collection name for this source
        config:          Generation config dict (model, style, detail_level, etc.)
        user_id:         Initiating user UUID string
        doc_gen_id:      DocumentGeneration UUID string (for logging)

    Returns:
        Tuple of:
          - markdown (str):         Complete generated documentation
          - sections_metadata (dict): {sections, generated_model, input_tokens,
                                       output_tokens, estimated_cost_usd, generation_time_seconds}

    Raises:
        Exception: Propagated to pipeline.py for error handling + DB update
    """
    model = config.get("model", "gpt-4o-mini")

    agent_ctx = DocumentationAgentContext(
        source_id=source_id,
        collection_name=collection_name,
        user_id=user_id,
        doc_gen_id=doc_gen_id,
        config=config,
    )

    tools = [
        extract_entities,
        get_architecture_overview,
        get_code_examples,
        doc_vector_search,
        doc_graph_search,
    ]

    system_prompt = _build_doc_system_prompt(config)
    user_prompt   = _build_doc_user_prompt(config)

    # o1-mini does not support temperature/top_p overrides (must use defaults)
    agent = Agent[DocumentationAgentContext](
        name="GraphLM Documentation Agent",
        model=model,
        instructions=system_prompt,
        tools=tools,
    )

    messages = [{"role": "user", "content": user_prompt}]

    logger.info(
        f"[DocAgent {doc_gen_id}] Starting with model={model}, "
        f"style={config.get('style')}, detail={config.get('detail_level')}"
    )

    start_time = time.monotonic()

    result = await Runner.run(
        agent,
        messages,
        context=agent_ctx,
    )

    elapsed = round(time.monotonic() - start_time, 1)
    markdown = result.final_output or ""

    logger.info(
        f"[DocAgent {doc_gen_id}] Completed in {elapsed}s. "
        f"Markdown length: {len(markdown)} chars"
    )

    # ── Extract usage metadata from raw response if available ─────────────
    input_tokens  = 0
    output_tokens = 0
    try:
        usage = result.raw_responses[-1].usage if result.raw_responses else None
        if usage:
            input_tokens  = getattr(usage, "input_tokens",  0) or 0
            output_tokens = getattr(usage, "output_tokens", 0) or 0
    except Exception:
        pass  # Non-fatal: usage tracking is best-effort

    estimated_cost = _estimate_cost(model, input_tokens, output_tokens)

    sections_metadata = {
        "sections": _extract_sections(markdown),
        "generated_model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "estimated_cost_usd": estimated_cost,
        "generation_time_seconds": elapsed,
    }

    return markdown, sections_metadata


# ─────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────

def _extract_sections(markdown: str) -> list[dict]:
    """
    Parse markdown headings into a structured section outline.
    Returns list of {title, level, char_start, char_end}.
    """
    sections = []
    pattern  = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)

    matches = list(pattern.finditer(markdown))
    for i, match in enumerate(matches):
        level = len(match.group(1))
        title = match.group(2).strip()
        char_start = match.start()
        char_end   = matches[i + 1].start() if i + 1 < len(matches) else len(markdown)
        sections.append({
            "title":      title,
            "level":      level,
            "char_start": char_start,
            "char_end":   char_end,
        })

    return sections


# Approximate USD cost per 1M tokens (as of mid-2026 — update as pricing changes)
_COST_PER_1M: dict[str, dict[str, float]] = {
    "o1-mini":     {"input": 3.00,  "output": 12.00},
    "gpt-4o-mini": {"input": 0.15,  "output": 0.60},
    "gpt-4o":      {"input": 5.00,  "output": 15.00},
}

def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost from token counts. Returns 0.0 if model not in table."""
    pricing = _COST_PER_1M.get(model)
    if not pricing or not (input_tokens or output_tokens):
        return 0.0
    cost = (input_tokens / 1_000_000 * pricing["input"]) + \
           (output_tokens / 1_000_000 * pricing["output"])
    return round(cost, 6)
