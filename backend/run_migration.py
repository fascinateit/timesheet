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
        with open("../database/migrate_manager_projects.sql", "r") as f:
            sql = f.read()
        for statement in sql.split(';'):
            if statement.strip():
                cur.execute(statement)
    conn.commit()
    conn.close()
    print("Migration successful")

if __name__ == "__main__":
    run_migration()
