import mysql.connector


def get_connection():
    return mysql.connector.connect(
        host="localhost", 
        user="root", 
        password="", 
        database="productions",
        connection_timeout=5
    )
