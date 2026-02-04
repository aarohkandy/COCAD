# Let Cursor push to GitHub for you

Do this **once** on your computer so Git never asks for your username/password when pushing. After that, when you ask Cursor to "send to GitHub", it can run `git push` successfully.

---

## Option 1: Store your GitHub token (recommended)

1. **Create a Personal Access Token** (if you don’t have one):
   - https://github.com/settings/tokens
   - Generate new token (classic), check **repo**, copy the token.

2. **Tell Git to save credentials** (one time):
   ```bash
   git config --global credential.helper store
   ```

3. **Push once from your terminal** so Git saves the token:
   ```bash
   cd /home/a_a_k/Downloads/COCAD
   git push origin main
   ```
   When prompted:
   - **Username:** `aarohkandy`
   - **Password:** paste your **token** (not your GitHub password)

   Git will store these in `~/.git-credentials` and reuse them next time (including when Cursor runs `git push`).

4. **Test from Cursor:** Ask "send to GitHub" and Cursor will run `git push`; it should use the stored credentials.

---

## Option 2: Use SSH so no password is needed

1. **Fix the SSH config error** (if you still have it):
   ```bash
   sudo chmod 644 /etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf
   ```

2. **Create an SSH key** (if you don’t have one):
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/id_ed25519 -N ""
   ```

3. **Add the key to GitHub:**
   - Copy: `cat ~/.ssh/id_ed25519.pub`
   - GitHub → Settings → SSH and GPG keys → New SSH key → paste.

4. **Use SSH for this repo:**
   ```bash
   cd /home/a_a_k/Downloads/COCAD
   git remote set-url origin git@github.com:aarohkandy/COCAD.git
   git push origin main
   ```
   (You may be asked once to confirm GitHub’s host key; type `yes`.)

5. **Start ssh-agent and add your key** (so non-interactive pushes work):
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```
   If you want the key loaded every time you log in, add that to your shell profile (e.g. `~/.bashrc`).

After this, Cursor can run `git push` and SSH will use your key without asking for a password.

---

## Check that it’s set up

- **HTTPS + store:**  
  `git config --global credential.helper` should print `store`, and you should have pushed at least once so `~/.git-credentials` exists.

- **SSH:**  
  `ssh -T git@github.com` should say: `Hi aarohkandy! You've successfully authenticated...`

Once one of these works from your terminal, Cursor can "send" for you by running `git push`.
