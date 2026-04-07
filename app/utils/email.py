import logging
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from fastapi_mail.schemas import MessageType, MultipartSubtypeEnum
from app.core.config import settings

logger = logging.getLogger(__name__)

# Setup Jinja2 environment
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"]),
)

# Setup email configuration
mail_config = ConnectionConfig(
    MAIL_SERVER=settings.MAILTRAP_SMTP_HOST,
    MAIL_PORT=settings.MAILTRAP_SMTP_PORT,
    MAIL_USERNAME=settings.MAILTRAP_SMTP_USER,
    MAIL_PASSWORD=settings.MAILTRAP_SMTP_PASS,
    MAIL_FROM=settings.MAILTRAP_SENDEREMAIL,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_TLS=True,
    MAIL_SSL=False,
    USE_CREDENTIALS=True,
)


def render_email_template(template_name: str, context: dict) -> str:
    """
    Render email template using Jinja2.

    Args:
        template_name: Template file name (e.g., "email/verify_email.html" or "email/verify_email.txt")
        context: Dictionary of variables to pass to the template

    Returns:
        Rendered template string (HTML or plain text depending on template)
    """
    try:
        template = jinja_env.get_template(template_name)
        return template.render(context)
    except Exception as e:
        logger.error(f"Error rendering email template {template_name}: {e}")
        raise


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
) -> None:
    """
    Send email via SMTP (Mailtrap) with both HTML and plain text versions.

    Uses multipart/alternative to send both HTML and plain text.
    Email clients prefer HTML but fall back to plain text if needed.

    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML email body
        text_content: Plain text email body

    Note:
        Errors are logged but do not crash the application.
    """
    try:
        # Option 1: Send HTML directly (simpler, but no plain text fallback)
        # message = MessageSchema(
        #     subject=subject,
        #     recipients=[to_email],
        #     body=html_content,
        #     subtype=MessageType.html,
        # )

        # Option 2: Send both HTML and plain text versions
        message = MessageSchema(
            subject=subject,
            recipients=[to_email],
            body=text_content,
            alternative_body=html_content,
            subtype=MessageType.plain,
            multipart_subtype=MultipartSubtypeEnum.alternative,
        )

        fm = FastMail(mail_config)
        await fm.send_message(message)
        logger.info(f"Email sent successfully to {to_email}")
    except Exception as e:
        logger.error(f"Error occurred while sending email to {to_email}: {e}")
        # Don't raise - let the application continue


def email_verification_template(username: str, verification_url: str) -> dict:
    """
    Generate email verification content object.

    Returns context dictionary for template rendering.
    Mirrors Express: emailVerificationMailGenContent()

    The same context is passed to BOTH HTML and plaintext templates.

    Args:
        username: User's username
        verification_url: Email verification link

    Returns:
        Content context dictionary with template variables
    """
    return {
        "username": username,
        "title": "Verify your email",
        "intro": "Welcome to GraphLM! We're very excited to have you on board.",
        "action_instructions": "To get started, please verify your email by clicking the link below:",
        "action_button_text": "Verify your email",
        "action_button_url": verification_url,
        "action_button_color": "#22BC66",
        "outro": "Need help, or have questions? Just reply to this email, we'd love to help.",
    }


def reset_password_template(username: str, reset_url: str) -> dict:
    """
    Generate password reset content object.

    Returns context dictionary for template rendering.
    Mirrors Express: resetPasswordMailGenContent()

    The same context is passed to BOTH HTML and plaintext templates.

    Args:
        username: User's username
        reset_url: Password reset link

    Returns:
        Content context dictionary with template variables
    """
    return {
        "username": username,
        "title": "Reset your password",
        "intro": "You have received this email because a password reset request for your account was received.",
        "action_instructions": "Click the link below to reset your password:",
        "action_button_text": "Reset your password",
        "action_button_url": reset_url,
        "action_button_color": "#DC4D2F",
        "outro": "If you did not request a password reset, no further action is required.",
    }


async def send_verification_email(user, verification_url: str) -> None:
    """
    High-level function to send verification email.

    Replicates Express flow:
    1. Generate content object (mailGenContent)
    2. Render HTML template with content
    3. Render plaintext template with same content
    4. Send both versions

    Args:
        user: User object with username and email attributes
        verification_url: Verification link
    """
    # Generate content (like Mailgen content object)
    context = email_verification_template(user.username, verification_url)

    # Render HTML template
    html_content = render_email_template("email/verify_email.html", context)

    # Render plaintext template with SAME context
    text_content = render_email_template("email/verify_email.txt", context)

    # Send email with both versions
    await send_email(
        to_email=user.email,
        subject="Verify your email",
        html_content=html_content,
        text_content=text_content,
    )


async def send_password_reset_email(user, reset_url: str) -> None:
    """
    High-level function to send password reset email.

    Replicates Express flow:
    1. Generate content object (mailGenContent)
    2. Render HTML template with content
    3. Render plaintext template with same content
    4. Send both versions

    Args:
        user: User object with username and email attributes
        reset_url: Password reset link
    """
    # Generate content (like Mailgen content object)
    context = reset_password_template(user.username, reset_url)

    # Render HTML template
    html_content = render_email_template("email/reset_password.html", context)

    # Render plaintext template with SAME context
    text_content = render_email_template("email/reset_password.txt", context)

    # Send email with both versions
    await send_email(
        to_email=user.email,
        subject="Reset your password",
        html_content=html_content,
        text_content=text_content,
    )


