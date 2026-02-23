import os

import os


class Config:
    SECRET_KEY = "20261011"

    MYSQL_USER = "root"
    MYSQL_PASSWORD = "your_password"
    MYSQL_HOST = "localhost"
    MYSQL_DB = "production_budget"

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DB}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
