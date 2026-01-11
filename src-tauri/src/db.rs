use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Registration {
    pub id: Option<i64>,
    pub competitor_first_name: String,
    pub competitor_last_name: String,
    pub club: String,
    pub eol_number: String,
    pub course_id: i64,
    pub course_name: String,
    pub price: f64,
    pub timestamp: String,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        
        // Create the registrations table if it doesn't exist
        conn.execute(
            "CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                competitor_first_name TEXT NOT NULL,
                competitor_last_name TEXT NOT NULL,
                club TEXT NOT NULL,
                eol_number TEXT NOT NULL,
                course_id INTEGER NOT NULL,
                course_name TEXT NOT NULL,
                price REAL NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn insert_registration(&self, registration: &Registration) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT INTO registrations (
                competitor_first_name,
                competitor_last_name,
                club,
                eol_number,
                course_id,
                course_name,
                price,
                timestamp
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            (
                &registration.competitor_first_name,
                &registration.competitor_last_name,
                &registration.club,
                &registration.eol_number,
                &registration.course_id,
                &registration.course_name,
                &registration.price,
                &registration.timestamp,
            ),
        )?;

        Ok(conn.last_insert_rowid())
    }

    pub fn get_all_registrations(&self) -> Result<Vec<Registration>> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT 
                id,
                competitor_first_name,
                competitor_last_name,
                club,
                eol_number,
                course_id,
                course_name,
                price,
                timestamp
            FROM registrations
            ORDER BY timestamp DESC"
        )?;

        let registrations = stmt.query_map([], |row| {
            Ok(Registration {
                id: Some(row.get(0)?),
                competitor_first_name: row.get(1)?,
                competitor_last_name: row.get(2)?,
                club: row.get(3)?,
                eol_number: row.get(4)?,
                course_id: row.get(5)?,
                course_name: row.get(6)?,
                price: row.get(7)?,
                timestamp: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

        Ok(registrations)
    }

    pub fn get_recent_registrations(&self, limit: usize) -> Result<Vec<Registration>> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT 
                id,
                competitor_first_name,
                competitor_last_name,
                club,
                eol_number,
                course_id,
                course_name,
                price,
                timestamp
            FROM registrations
            ORDER BY timestamp DESC
            LIMIT ?1"
        )?;

        let registrations = stmt.query_map([limit], |row| {
            Ok(Registration {
                id: Some(row.get(0)?),
                competitor_first_name: row.get(1)?,
                competitor_last_name: row.get(2)?,
                club: row.get(3)?,
                eol_number: row.get(4)?,
                course_id: row.get(5)?,
                course_name: row.get(6)?,
                price: row.get(7)?,
                timestamp: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

        Ok(registrations)
    }
}
