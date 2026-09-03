# SIH26162 — Quick EC2 Deployment Guide

Follow these 3 quick steps once your EC2 instance is in **Running** state.

---

### Step 1: Copy Project to your EC2 Instance

Open PowerShell or Terminal in `V:\SIH26162` and run:

```powershell
# Replace <YOUR-KEY.pem> and <EC2-PUBLIC-IP> with your real key path and EC2 IP:
scp -i "C:\path\to\your-key.pem" -r . ubuntu@<EC2-PUBLIC-IP>:~/SIH26162
```

*(Alternatively, if your code is on GitHub, you can simply SSH in and run `git clone <your-repo-url> ~/SIH26162`)*

---

### Step 2: SSH into your EC2 Instance

```powershell
ssh -i "C:\path\to\your-key.pem" ubuntu@<EC2-PUBLIC-IP>
```

---

### Step 3: Run the 1-Line Setup Script

Once logged in to the EC2 terminal, run:

```bash
chmod +x ~/SIH26162/deploy/setup.sh
~/SIH26162/deploy/setup.sh
```

---

### 🎉 You're Live!

Open your browser at:
`http://<EC2-PUBLIC-IP>`

- **Live Web GUI:** `http://<EC2-PUBLIC-IP>`
- **Live Mission Control Map:** `http://<EC2-PUBLIC-IP>/map`
- **FastAPI OpenAPI Docs:** `http://<EC2-PUBLIC-IP>/docs`

#### Useful Maintenance Commands:
- Check logs: `pm2 logs`
- Status of apps: `pm2 status`
- Restart apps: `pm2 restart all`
