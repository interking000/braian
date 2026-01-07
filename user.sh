#!/bin/bash

clear

echo -e "\e[1;36m╔══════════════════════════════════════════════════════════════╗"
echo -e "\e[1;36m║              DTunnel Panel - Usuarios Registrados             ║"
echo -e "\e[1;36m╚══════════════════════════════════════════════════════════════╝\e[0m"

node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/* ===== COLORES ANSI ===== */
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

(async () => {
  const users = await prisma.user.findMany({
    orderBy: { created_at: 'asc' }
  });

  if (!users.length) {
    console.log(`\n${C.red}❌ No hay usuarios registrados${C.reset}\n`);
    return;
  }

  users.forEach((u, i) => {
    console.log(`
${C.cyan}╔══════════════════════════════════════════════════════════════╗${C.reset}
${C.cyan}║${C.reset} ${C.bold}${C.yellow}USUARIO #${i + 1}${C.reset}
${C.cyan}╠══════════════════════════════════════════════════════════════╣${C.reset}
${C.cyan}║${C.reset} 👤 Usuario     : ${C.green}${u.username}${C.reset}
${C.cyan}║${C.reset} 🔑 Contraseña  : ${C.red}${u.password}${C.reset}
${C.cyan}║${C.reset} 📧 Email       : ${C.magenta}${u.email}${C.reset}
${C.cyan}║${C.reset} 🆔 ID          : ${C.blue}${u.id}${C.reset}
${C.cyan}║${C.reset} 🔐 Token       : ${C.blue}${u.id}${C.reset}
${C.cyan}║${C.reset} 📅 Creado      : ${C.gray}${u.created_at.toISOString()}${C.reset}
${C.cyan}╚══════════════════════════════════════════════════════════════╝${C.reset}
`);
  });

  console.log(`${C.bold}${C.green}✔ Total usuarios: ${users.length}${C.reset}\n`);
  await prisma.$disconnect();
})();
NODE
