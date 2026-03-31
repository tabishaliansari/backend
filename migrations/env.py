from app.db.base import Base
from app.core.config import settings

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata