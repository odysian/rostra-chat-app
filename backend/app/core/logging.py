import logging
import sys


def setup_logging():
    """Configure application logging"""

    # Create logger
    logger = logging.getLogger("chatapp")
    logger.setLevel(logging.INFO)

    # Create console handler with formatting
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)

    # Create formatter
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)

    logger.addHandler(handler)

    return logger


logger = setup_logging()
