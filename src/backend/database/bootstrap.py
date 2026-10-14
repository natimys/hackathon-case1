import importlib
from importlib.util import find_spec

from core.modules import iter_module_names
from loguru import logger


def bootstrap_models():
    """Import every module's models so Alembic metadata reflects the full schema.

    A disabled API module still owns its tables. Filtering on ``active`` here
    makes Alembic autogenerate propose dropping those tables.
    """
    for module_name in iter_module_names():
        module_path = f"modules.{module_name}.models"
        if find_spec(module_path):
            importlib.import_module(module_path)
            logger.debug(f"✅ Successfully bootstrapped models for <{module_name}>")
