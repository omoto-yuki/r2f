# r2f

r2f is a database record relationship finder that helps find related records in other tables of a certain record. This is especially useful when you want to delete a record.

# Usage

You can use these environment variables.

|name|required|
|---|---|
|DB_HOST|yes|
|DB_USER|yes|
|DB_PASS|yes|
|DB_NAME|yes|
|DB_PORT|yes|
|SSH_HOST|no|
|SSH_USER|no|
|SSH_KEY|no|
|SSH_PORT|no|

After setting the environment variables, you can the command:

```bash
r2f [your table name] [your record id]
```

r2f currently only works on MySQL...

## Supported MySQL Versions

- MySQL 8.0
