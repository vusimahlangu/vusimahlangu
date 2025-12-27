// CareerBridge Pro - Express + Sequelize server with SendGrid OTP
const express = require("express");
const bodyParser = require("body-parser");
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");
const sendgrid = require("@sendgrid/mail");

const app = express();
app.use(bodyParser.json());

// Setup SendGrid if available
if (process.env.SENDGRID_API_KEY) {
  sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("SendGrid configured.");
} else {
  console.log("SENDGRID_API_KEY not set — OTP emails will not be sent (OTP returned in response).");
}

// Database (Postgres via DATABASE_URL or SQLite fallback)
const DATABASE_URL = process.env.DATABASE_URL || null;
let sequelize;

if (DATABASE_URL) {
  sequelize = new Sequelize(DATABASE_URL, {
    logging: false,
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { rejectUnauthorized: false } } : {}
  });
  console.log("Using DATABASE_URL (Postgres).");
} else {
  const storagePath = process.env.DB_FILE || path.join(__dirname, "data", "careerbridge.db");
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: storagePath,
    logging: false
  });
  console.log("Using SQLite at", storagePath);
}

// Models
const User = sequelize.define("User", {
  role: DataTypes.STRING,
  email: { type: DataTypes.STRING, unique: true },
  otp: DataTypes.STRING
});

const Job = sequelize.define("Job", {
  title: DataTypes.STRING,
  category: DataTypes.STRING,
  description: DataTypes.TEXT
});

const Application = sequelize.define("Application", {
  job_id: DataTypes.INTEGER,
  applicant_email: DataTypes.STRING
});

// Sync DB
(async () => {
  await sequelize.sync();
  console.log("Database synced.");
})();

// Simple HTML frontend (single-page)
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CareerBridge Pro</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{font-family:Inter,system-ui,Arial;margin:0;background:#f8fafc;color:#0f172a}
nav{height:70px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;padding:0 24px;font-weight:600}
main{padding:40px;max-width:800px;margin:0 auto}
button{padding:10px 16px;border:none;background:#2563eb;color:#fff;border-radius:8px;cursor:pointer}
.card{background:#fff;padding:18px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:12px}
input,textarea,select{width:100%;padding:10px;margin-bottom:10px;border-radius:8px;border:1px solid #cbd5e1}
.small{font-size:0.9rem;color:#475569}
</style>
</head>
<body>
<nav>CareerBridge Pro</nav>
<main>
<h2>Login</h2>
<input id="email" placeholder="Email" type="email">
<select id="role">
<option value="candidate">Candidate</option>
<option value="employer">Employer</option>
</select>
<button onclick="login()">Send OTP</button>
<div id="otpBox" style="display:none">
<input id="otp" placeholder="Enter OTP">
<button onclick="verify()">Verify</button>
</div>
<p class="small">For demo, OTP is shown in browser if email sending is not configured.</p>
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
  if(!email.value){alert('Enter email');return;}
  const res = await fetch('/login',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:email.value,role:role.value})
  });
  const data = await res.json();
  if(data.otp) alert("OTP (for demo): " + data.otp);
  otpBox.style.display = "block";
}
async function verify(){
  if(!email.value||!otp.value){alert('Enter email and otp');return;}
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
    jobsDiv.innerHTML += `
      <div class="card">
        <strong>${j.title}</strong><br>
        <em>${j.category}</em>
        <p>${j.description}</p>
        <button onclick="apply(${j.id})">Apply</button>
      </div>`;
  });
}
async function postJob(){
  if(!title.value){alert('Title required');return;}
  await fetch('/jobs',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      title:title.value,category:category.value,description:desc.value
    })
  });
  title.value='';category.value='';desc.value='';
  loadJobs();
}
async function apply(id){
  if(!email.value){alert('Enter email to apply');return;}
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
  
// Routes
app.get("/", (req, res) => res.send(html));

app.post("/login", async (req, res) => {
  const { email, role } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  try {
    await User.upsert({ email, role, otp });
    // Send email via SendGrid if configured
    if (process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM) {
      try {
        await sendgrid.send({
          to: email,
          from: process.env.EMAIL_FROM,
          subject: "Your CareerBridge OTP",
          text: `Your OTP is ${otp}`,
          html: `<p>Your OTP is <strong>${otp}</strong></p>`
        });
      } catch (err) {
        console.error("SendGrid error:", err);
      }
    }
    // For demo: return OTP in response if SendGrid isn't configured or for convenience
    res.json({ otp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db error" });
  }
});

app.post("/verify", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.sendStatus(400);
  try {
    const user = await User.findOne({ where: { email, otp } });
    if (user) return res.sendStatus(200);
    return res.sendStatus(401);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.get("/jobs", async (req, res) => {
  try {
    const jobs = await Job.findAll({ order: [["id", "DESC"]] });
    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

app.post("/jobs", async (req, res) => {
  const { title, category, description } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  try {
    await Job.create({ title, category, description });
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post("/apply", async (req, res) => {
  const { job_id, applicant_email } = req.body;
  if (!job_id || !applicant_email) return res.status(400).json({ error: "job_id and applicant_email required" });
  try {
    await Application.create({ job_id, applicant_email });
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("CareerBridge Pro running at http://localhost:" + PORT));
