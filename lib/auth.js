const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Error creating data directory:', e);
  }
}

// Helper to hash password
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// Load users from storage
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    // Seed initial architectural account
    const initialSalt = crypto.randomBytes(16).toString('hex');
    const initialUsers = [
      {
        id: 'usr_cgm_master',
        name: 'Cesar González',
        email: 'cesar@cgmatelier.com',
        salt: initialSalt,
        hash: hashPassword('arquitectura2026', initialSalt),
        workspaces: ['CGM Atelier', 'Estudio Principal'],
        activeWorkspace: 'CGM Atelier',
        createdAt: new Date().toISOString()
      }
    ];
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf8');
      return initialUsers;
    } catch (e) {
      return initialUsers;
    }
  }
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Error reading users file:', e);
    return [];
  }
}

// Save users to storage
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving users file:', e);
  }
}

// Register a new user
function registerUser({ name, email, password, workspace }) {
  if (!email || typeof email !== 'string') {
    return { ok: false, status: 400, error: 'Se requiere un correo electrónico válido.' };
  }
  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { ok: false, status: 400, error: 'El formato de correo electrónico no es válido.' };
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return { ok: false, status: 400, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { ok: false, status: 400, error: 'El nombre completo es requerido.' };
  }

  const users = loadUsers();
  const exists = users.find(u => u.email.toLowerCase() === cleanEmail);
  if (exists) {
    return { ok: false, status: 409, error: 'Ya existe una cuenta registrada con este correo electrónico.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const cleanWs = (workspace && workspace.trim()) || 'Estudio Principal';

  const newUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: name.trim(),
    email: cleanEmail,
    salt,
    hash,
    workspaces: [cleanWs],
    activeWorkspace: cleanWs,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  return {
    ok: true,
    status: 201,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      workspaces: newUser.workspaces,
      activeWorkspace: newUser.activeWorkspace
    }
  };
}

// Login user with credentials check
function loginUser({ email, password }) {
  if (!email || !password) {
    return { ok: false, status: 400, error: 'Introduce correo electrónico y contraseña.' };
  }
  const cleanEmail = email.trim().toLowerCase();
  const users = loadUsers();
  const user = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return { ok: false, status: 401, error: 'No existe ninguna cuenta registrada con este correo. Regístrate para comenzar.' };
  }

  const testHash = hashPassword(password, user.salt);
  if (testHash !== user.hash) {
    return { ok: false, status: 401, error: 'Contraseña incorrecta. Por favor verifica tus credenciales.' };
  }

  return {
    ok: true,
    status: 200,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      workspaces: user.workspaces,
      activeWorkspace: user.activeWorkspace
    }
  };
}

// Manage user workspaces
function manageWorkspace({ email, workspaceName, action }) {
  if (!email || !workspaceName) {
    return { ok: false, status: 400, error: 'Datos incompletos.' };
  }
  const cleanEmail = email.trim().toLowerCase();
  const users = loadUsers();
  const user = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return { ok: false, status: 404, error: 'Usuario no encontrado.' };
  }

  const cleanWs = workspaceName.trim();
  if (action === 'create') {
    if (!user.workspaces.includes(cleanWs)) {
      user.workspaces.push(cleanWs);
    }
    user.activeWorkspace = cleanWs;
  } else if (action === 'select') {
    if (user.workspaces.includes(cleanWs)) {
      user.activeWorkspace = cleanWs;
    }
  }

  saveUsers(users);
  return {
    ok: true,
    status: 200,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      workspaces: user.workspaces,
      activeWorkspace: user.activeWorkspace
    }
  };
}

module.exports = {
  loadUsers,
  registerUser,
  loginUser,
  manageWorkspace
};
