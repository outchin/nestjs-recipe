-- Runs once on a fresh volume. Lets the app user create/drop databases
-- (e.g. throwaway test DBs for migration labs). Local dev only!
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES ON *.* TO 'lab'@'%';
FLUSH PRIVILEGES;
