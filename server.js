// ========================================
// CareerBridge Pro — Single File Solution
// ========================================

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");

const app = express();
const db = new sqlite3.Database("./careerbridge.db");

app.use(bodyParser.json());

// ---------------------
// DATABASE
// ---------------------
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT,
      email TEXT UNIQUE,
      otp TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      category TEXT,
      description TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER,
      applicant_email TEXT
    )
  `);
});

// ---------------------
// FRONTEND (HTML)
// ---------------------
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CareerBridge Pro</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
body{font-family:Inter;margin:0;background:#f8fafc;color:#0f172a}
nav{height:70px;background:#fff;border-bottom:1px solid #e2e8f0;
display:flex;align-items:center;padding:0 40px;font-weight:600}
main{padding:60px}
button{padding:12px 20px;border:none;background:#2563eb;color:#fff;
border-radius:8px;cursor:pointer;transition:.4s}
button:hover{transform:translateY(-2px)}
.card{background:#fff;padding:24px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:16px}
input,textarea,select{width:100%;padding:12px;margin-bottom:12px;border-radius:8px;border:1px solid #cbd5e1}
</style>
</head>
<body>

<nav>CareerBridge Pro</nav>

<main>
<h2>Login</h2>
<input id="email" placeholder="Email">
<select id="role">
<option value="candidate">Candidate</option>
<option value="employer">Employer</option>
</select>
<button onclick="login()">Send OTP</button>

<div id="otpBox" style="display:none">
<input id="otp" placeholder="Enter OTP">
<button onclick="verify()">Verify</button>
</div>

<hr>
<h2>Jobs</h2>
<div id="jobs"></div>

<h3>Post Job (Employer)</h3>
<input id="title" placeholder="Job Title">
<input id="category" placeholder="Category">
<textarea id="desc" placeholder="Description"></textarea>
<button onclick="postJob()">Post Job</button>
</main>

<script>
async function login(){
  const res = await fetch('/login',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:email.value,role:role.value})
  });
  const data = await res.json();
  alert("OTP: " + data.otp);
  otpBox.style.display = "block";
}

async function verify(){
  const res = await fetch('/verify',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:email.value,otp:otp.value})
  });
  alert(res.ok ? "Verified" : "Invalid OTP");
}

async function loadJobs(){
  const res = await fetch('/jobs');
  const jobs = await res.json();
  jobsDiv.innerHTML='';
  jobs.forEach(j=>{
    jobsDiv.innerHTML += \`
      <div class="card">
        <strong>\${j.title}</strong><br>
        \${j.category}
        <p>\${j.description}</p>
        <button onclick="apply(\${j.id})">Apply</button>
      </div>\`;
  });
}

async function postJob(){
  await fetch('/jobs',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      title:title.value,
      category:category.value,
      description:desc.value
    })
  });
  loadJobs();
}

async function apply(id){
  await fetch('/apply',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({job_id:id,applicant_email:email.value})
  });
  alert("Application submitted");
}

const jobsDiv = document.getElementById("jobs");
loadJobs();
</script>

</body>
</html>
`;

// ---------------------
// ROUTES
// ---------------------
app.get("/", (req, res) => res.send(html));

app.post("/login", (req, res) => {
  const { email, role } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  db.run(
    `INSERT OR REPLACE INTO users (email, role, otp) VALUES (?, ?, ?)`,
    [email, role, otp],
    () => res.json({ otp })
  );
});

app.post("/verify", (req, res) => {
  const { email, otp } = req.body;
  db.get(
    `SELECT * FROM users WHERE email=? AND otp=?`,
    [email, otp],
    (err, row) => row ? res.sendStatus(200) : res.sendStatus(401)
  );
});

app.get("/jobs", (req, res) => {
  db.all(`SELECT * FROM jobs`, (err, rows) => res.json(rows));
});

app.post("/jobs", (req, res) => {
  const { title, category, description } = req.body;
  db.run(
    `INSERT INTO jobs (title, category, description) VALUES (?,?,?)`,
    [title, category, description],
    () => res.sendStatus(200)
  );
});

app.post("/apply", (req, res) => {
  const { job_id, applicant_email } = req.body;
  db.run(
    `INSERT INTO applications (job_id, applicant_email) VALUES (?,?)`,
    [job_id, applicant_email],
    () => res.sendStatus(200)
  );
});

// ---------------------
app.listen(3000, () =>
  console.log("CareerBridge Pro running at http://localhost:3000")
);
