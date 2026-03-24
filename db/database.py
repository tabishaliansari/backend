from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://myuser:mypassword@localhost:5432/graphlm"

engine = create_engine(DATABASE_URL)

def check_db_connection():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"database_status": "Connected to postgres"}
    except Exception as e:
        return {"database_status": "Not connected", "error": str(e)}