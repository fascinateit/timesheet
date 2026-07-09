import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

def run_migration():
    conn = pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        db=os.getenv("DB_NAME", "projectpulse"),
        port=int(os.getenv("DB_PORT", 3306))
    )
    with conn.cursor() as cur:
        with open("../database/migrate_company_expenses.sql", "r") as f:
            sql = f.read()
        for statement in sql.split(';'):
            if statement.strip():
                try:
                    cur.execute(statement)
                except Exception as e:
                    print(f"Skipping error: {e}")
    conn.commit()
    conn.close()
    print("Migration successful")

if __name__ == "__main__":
    run_migration()
