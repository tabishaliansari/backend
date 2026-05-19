import logging
import sys
from app.core.config import settings

class UvicornStyleFormatter(logging.Formatter):
    """
    Custom formatter that formats the log level to match Uvicorn's style
    (e.g., 'INFO:    ') with color, while keeping the custom time and date format.
    """
    # ANSI escape codes for colors
    COLOR_RESET = "\x1b[0m"
    LEVEL_COLORS = {
        "DEBUG": "\x1b[34m",       # Blue
        "INFO": "\x1b[32m",        # Green
        "WARNING": "\x1b[33m",     # Yellow
        "ERROR": "\x1b[31m",       # Red
        "CRITICAL": "\x1b[31;1m",  # Bold Red
    }

    def __init__(self, *args, use_colors: bool = True, **kwargs):
        super().__init__(*args, **kwargs)
        self.use_colors = use_colors

    def format(self, record):
        if (
            getattr(record, "args", None)
            and isinstance(record.args, tuple)
            and len(record.args) >= 5
            and not hasattr(record, "client_addr")
        ):
            client_addr, method, path, http_version, status_code = record.args[:5]
            record.client_addr = client_addr
            record.request_line = f"{method} {path} HTTP/{http_version}"
            record.status_code = status_code

        orig_levelname = record.levelname
        
        # 1. Format levelname with trailing colon and pad to 9 chars
        padded_level = f"{orig_levelname}:".ljust(9)
        
        # 2. Add ANSI color prefix and suffix if colors are enabled
        if self.use_colors and sys.stdout.isatty():
            color = self.LEVEL_COLORS.get(orig_levelname, "")
            if color:
                record.levelname = f"{color}{padded_level}{self.COLOR_RESET}"
            else:
                record.levelname = padded_level
        else:
            record.levelname = padded_level
            
        result = super().format(record)
        record.levelname = orig_levelname
        return result

def setup_logger(name: str = "graphlm") -> logging.Logger:
    """
    Configure and return a standardized logger for the application.
    """
    logger = logging.getLogger(name)
    
    # Set the logging level based on the environment configuration
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    logger.setLevel(log_level)
    
    # Avoid adding multiple handlers if the logger is retrieved multiple times
    if not logger.handlers:
        # Console handler outputs to stdout
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        
        # Format the log output to look like Uvicorn's but keeping date & time
        formatter = UvicornStyleFormatter(
            fmt="%(asctime)s | %(levelname)s %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
            use_colors=True
        )
        console_handler.setFormatter(formatter)
        
        # Add the console handler to the logger
        logger.addHandler(console_handler)
        
        # Optional: Prevent log messages from being propagated to the root logger
        logger.propagate = False

    return logger

def get_logging_config():
    """
    Return a unified logging configuration dict for Uvicorn
    that integrates our colorized, timestamped UvicornStyleFormatter.
    """
    import copy
    from uvicorn.config import LOGGING_CONFIG
    
    config = copy.deepcopy(LOGGING_CONFIG)
    
    # Configure uvicorn to use our formatter class
    config["formatters"]["default"] = {
        "()": "app.utils.logger.UvicornStyleFormatter",
        "fmt": "%(asctime)s | %(levelname)s %(message)s",
        "datefmt": "%Y-%m-%d %H:%M:%S",
        "use_colors": True,
    }
    
    config["formatters"]["access"] = {
        "()": "app.utils.logger.UvicornStyleFormatter",
        "fmt": '%(asctime)s | %(levelname)s %(client_addr)s - "%(request_line)s" %(status_code)s',
        "datefmt": "%Y-%m-%d %H:%M:%S",
        "use_colors": True,
    }
    
    return config

# Create a default logger instance to be imported throughout the app
logger = setup_logger()
