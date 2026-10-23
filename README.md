# Clinic Management System (CMS)

A full-stack Clinic Management System monorepo with a Django REST Framework backend and a lightweight HTML/CSS/JavaScript frontend.

---

## Backend Setup

Follow the steps below to configure and run the backend locally.

### 1. Prerequisites
- Python 3.10+ (tested with Python 3.13)
- MySQL Server 8.0+ running locally (default port: 3306)
- MySQL client libraries installed

### 2. Virtual Environment Setup
From the repository root:
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
Install all required packages from `backend/ClinicManagement/requirements.txt`:
```bash
pip install -r backend/ClinicManagement/requirements.txt
```

### 4. Create MySQL Databases
Log into your MySQL instance as an administrative user (e.g. `root`) and create the primary application database:
```sql
CREATE DATABASE ClinicDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> **Note for Testing:** When running `python manage.py test`, Django automatically creates and drops a separate test database (`test_ClinicDB`). Ensure your database user has the necessary `CREATE DATABASE` and `DROP DATABASE` privileges:
> ```sql
> GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost';
> FLUSH PRIVILEGES;
> ```

### 5. Configure Environment Variables (.env)
Copy the example environment configuration into `backend/ClinicManagement/.env`:
```bash
cp backend/ClinicManagement/.env.example backend/ClinicManagement/.env
```
Edit `backend/ClinicManagement/.env` with your actual MySQL database credentials and settings:
```ini
SECRET_KEY=your-secure-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=ClinicDB
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_HOST=localhost
DB_PORT=3306
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5500,http://localhost:5500
```
> **Security Notice:** `.env` is ignored in `.gitignore`. Never commit real secrets or production database credentials to version control.

### 6. Run Migrations
Apply database migrations to your MySQL database:
```bash
python backend/ClinicManagement/manage.py migrate
```

### 7. Seed Demo Data
Populate the database with demo users, doctor profiles, patients, master medicines, and lab tests:
```bash
python backend/ClinicManagement/manage.py seed_demo
```
> **Refusal Guard:** `seed_demo` refuses to run if `DEBUG=False`. It is safe and idempotent to run multiple times.
>
> **DEV-ONLY Account Credentials:**
> All seeded demo accounts share the password:
> `DemoPassword123!`
>
> Seeded users and roles:
> - `admin` (`role='ADMIN'`)
> - `doctor` (`role='DOCTOR'`, Profile: `DOC001`)
> - `doctor2` (`role='DOCTOR'`, Profile: `DOC002`)
> - `doctor3` (`role='DOCTOR'`, Profile: `DOC003`)
> - `reception` (`role='RECEPTIONIST'`)
> - `lab` (`role='LAB_TECHNICIAN'`)
> - `pharmacy` (`role='PHARMACIST'`)

### 8. Superuser Notice (`createsuperuser`)
> **Important:** The custom `User` model sets `default='RECEPTIONIST'` for `role`. When using `python manage.py createsuperuser`, Django creates a user with staff and superuser flags, but its role defaults to `RECEPTIONIST`. To log in with administrative role permissions on `/api/admin/*`, ensure you update the role to `'ADMIN'`:
> ```bash
> python backend/ClinicManagement/manage.py shell -c "from apibackendapp.models import User; u = User.objects.get(username='your_superuser'); u.role = 'ADMIN'; u.save()"
> ```

### 9. Start the Development Server
```bash
python backend/ClinicManagement/manage.py runserver
```
The API will be available at `http://127.0.0.1:8000/`.

### 10. Run Tests
Execute the backend test suite against MySQL:
```bash
python backend/ClinicManagement/manage.py test apibackendapp adminapp receptionist doctor lab_tech pharmacy
```
This runs all unit, role-permission, scheduling, and concurrency tests (verifying pessimistic `select_for_update` row locking on InnoDB).
