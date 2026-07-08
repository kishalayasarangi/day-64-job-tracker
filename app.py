from flask import Flask, render_template, request, jsonify
import sqlite3
from datetime import datetime, date

app = Flask(__name__)
DB = "jobs.db"

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company TEXT NOT NULL,
            role TEXT NOT NULL,
            location TEXT DEFAULT "",
            type TEXT DEFAULT "Internship",
            status TEXT DEFAULT "Applied",
            applied_date TEXT DEFAULT CURRENT_DATE,
            deadline TEXT DEFAULT "",
            salary TEXT DEFAULT "",
            url TEXT DEFAULT "",
            notes TEXT DEFAULT "",
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )''')
        conn.commit()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/applications', methods=['GET'])
def get_applications():
    status = request.args.get('status', '')
    search = request.args.get('search', '')
    with get_db() as conn:
        query = 'SELECT * FROM applications WHERE 1=1'
        params = []
        if status:
            query += ' AND status = ?'
            params.append(status)
        if search:
            query += ' AND (company LIKE ? OR role LIKE ?)'
            params += [f'%{search}%', f'%{search}%']
        query += ' ORDER BY created_at DESC'
        apps = conn.execute(query, params).fetchall()
        return jsonify([dict(a) for a in apps])

@app.route('/api/applications', methods=['POST'])
def add_application():
    data = request.get_json()
    company = data.get('company', '').strip()
    role = data.get('role', '').strip()
    if not company or not role:
        return jsonify({'error': 'Company and role required'}), 400
    with get_db() as conn:
        cursor = conn.execute('''
            INSERT INTO applications
            (company,role,location,type,status,applied_date,deadline,salary,url,notes)
            VALUES (?,?,?,?,?,?,?,?,?,?)''',
            (company, role,
             data.get('location',''),
             data.get('type','Internship'),
             data.get('status','Applied'),
             data.get('applied_date', date.today().isoformat()),
             data.get('deadline',''),
             data.get('salary',''),
             data.get('url',''),
             data.get('notes',''))
        )
        conn.commit()
        a = conn.execute('SELECT * FROM applications WHERE id=?', (cursor.lastrowid,)).fetchone()
        return jsonify(dict(a)), 201

@app.route('/api/applications/<int:aid>', methods=['PUT'])
def update_application(aid):
    data = request.get_json()
    with get_db() as conn:
        fields = []
        params = []
        allowed = ['company','role','location','type','status',
                   'applied_date','deadline','salary','url','notes']
        for field in allowed:
            if field in data:
                fields.append(f'{field}=?')
                params.append(data[field])
        if not fields:
            return jsonify({'error': 'Nothing to update'}), 400
        params.append(aid)
        conn.execute(f'UPDATE applications SET {",".join(fields)} WHERE id=?', params)
        conn.commit()
        a = conn.execute('SELECT * FROM applications WHERE id=?', (aid,)).fetchone()
        return jsonify(dict(a))

@app.route('/api/applications/<int:aid>', methods=['DELETE'])
def delete_application(aid):
    with get_db() as conn:
        conn.execute('DELETE FROM applications WHERE id=?', (aid,))
        conn.commit()
        return jsonify({'success': True})

@app.route('/api/stats')
def get_stats():
    with get_db() as conn:
        total = conn.execute('SELECT COUNT(*) FROM applications').fetchone()[0]
        by_status = conn.execute('''
            SELECT status, COUNT(*) as count
            FROM applications GROUP BY status
        ''').fetchall()
        upcoming = conn.execute('''
            SELECT COUNT(*) FROM applications
            WHERE deadline != "" AND deadline >= ? AND status NOT IN ("Rejected","Accepted")
            ORDER BY deadline
        ''', (date.today().isoformat(),)).fetchone()[0]
        return jsonify({
            'total': total,
            'by_status': {r['status']: r['count'] for r in by_status},
            'upcoming_deadlines': upcoming
        })

if __name__ == '__main__':
    init_db()
    print("\n🚀 Job Tracker running at http://localhost:5000\n")
    app.run(debug=True)