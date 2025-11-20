import pyodbc

conn_str = "Driver={ODBC Driver 18 for SQL Server};Server=tcp:railwaydatabase.database.windows.net,1433;Database=railwaydb;Uid=railwayadmin;Pwd=adminait@2025;"
cnxn = pyodbc.connect(conn_str)
cursor = cnxn.cursor()
# Execute a query
cursor.execute("SELECT * FROM your_table")
row = cursor.fetchone()
print(row)
