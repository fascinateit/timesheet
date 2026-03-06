import db
import json

schema = db.query("DESCRIBE employees;")
print(json.dumps(schema, indent=2))
