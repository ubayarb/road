# Windows-оос сервер дээр setup.sh-ийг ажиллуулна (sudo нууц үг нэг удаа асууна).
# Хэрэглээ: powershell -ExecutionPolicy Bypass -File server\deploy\run-setup.ps1
$DeployKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPDhlnFIcWT/OtDuJXkdb6eLuUCJLi7CLG+iKbXY2Y8O github-actions-road-deploy'
$Remote = "cd /tmp && tar -xzf road-server.tgz server/deploy/setup.sh && sudo bash server/deploy/setup.sh ubayarb@gmail.com && (grep -qF '$DeployKey' ~/.ssh/authorized_keys || echo '$DeployKey' >> ~/.ssh/authorized_keys) && sudo rm -f /etc/sudoers.d/90-claude-temp && echo ALL_DONE"
ssh -t administrator@103.168.35.250 $Remote
