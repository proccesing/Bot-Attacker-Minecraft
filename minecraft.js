const mineflayer = require('mineflayer');
const readlineSync = require('readline-sync');
const net = require('net');
const { ProxyAgent } = require('proxy-agent');
const fs = require('fs');

(async () => {
    const chalk = (await import('chalk')).default;
    const gradient = (await import('gradient-string')).default;

    const bots = {};

    function checkServerStatus(host, port, callback) {
        const socket = net.createConnection(port, host);
        socket.setTimeout(10000);

        socket.on('connect', () => {
            console.log(`El servidor en ${host}:${port} está en línea.`);
            socket.end();
            callback(true);
        });

        socket.on('timeout', () => {
            console.log('El servidor no respondió a tiempo.');
            socket.destroy();
            callback(false);
        });

        socket.on('error', () => {
            console.log('No se pudo conectar al servidor. Puede que esté fuera de línea.');
            callback(false);
        });

        socket.on('close', () => {
            socket.destroy();
        });
    }

    function getProxies() {
        try {
            const proxies = fs.readFileSync('proxies.txt', 'utf-8').split('\n').filter(Boolean);
            return proxies;
        } catch (error) {
            console.error('Error al leer el archivo de proxies:', error);
            return [];
        }
    }

    function createBot(username, host, port, password, messageToSend, proxy) {
        const options = {
            host: host,
            port: port,
            username: username,
        };

        if (proxy) {
            options.agent = new ProxyAgent(proxy);
            console.log(`Bot ${username} se conectará a través de la proxy: ${proxy}`);
        }

        const bot = mineflayer.createBot(options);

        bot.on('login', async () => {
            console.log(`${username} se ha conectado al servidor.`);
            bots[username] = bot;

            // Movimiento aleatorio inmediato
            startRandomMovement(bot);
            startHeadMovement(bot);

            // Intento de registro
            attemptRegistration(bot, password);

            // Espera de 2 a 3 segundos antes de enviar el mensaje
            await delay(2000 + Math.random() * 1000);

            if (bot.entity) {
                bot.chat(messageToSend);
                console.log(`Bot ${bot.username} ha enviado el mensaje: "${messageToSend}".`);
            }
        });

        bot.on('chat', async (username, message) => {
            console.log(`[${username}]: ${message}`);

            if (message.toLowerCase().includes('register') || message.toLowerCase().includes('login')) {
                attemptRegistration(bot, password);
            }
        });

        bot.on('move', () => {
            if (bot.entity.velocity.y < -0.1) {
                console.log(`${bot.username} está cayendo. Deteniéndose hasta nuevo aviso.`);
                bot.clearControlStates();
            }
        });

        bot.on('kicked', (reason) => {
            console.log(`Bot ${username} fue expulsado: ${reason}`);
            reconnectBot(username, host, port, password, messageToSend, proxy);
        });

        bot.on('error', (err) => {
            console.error(`${username} no pudo ingresar por la siguiente razón: ${err}`);
            reconnectBot(username, host, port, password, messageToSend, proxy);
        });
    }

    function attemptRegistration(bot, password) {
        // Intentar registro con ambos formatos
        bot.chat(`/register ${password}`);
        console.log(`Bot ${bot.username} ha intentado registrarse con la contraseña: "${password}".`);

        setTimeout(() => {
            bot.chat(`/register ${password} ${password}`);
            console.log(`Bot ${bot.username} ha intentado registrarse con la contraseña doble: "${password} ${password}".`);
        }, 1000); // Esperar 1 segundo antes de intentar el segundo formato
    }

    function reconnectBot(username, host, port, password, messageToSend, proxy) {
        console.log(`Intentando reconectar bot: ${username}`);
        setTimeout(() => {
            createBot(username, host, port, password, messageToSend, proxy);
        }, 5000); // Intentar reconectar después de 5 segundos
    }

    function generateUsernames(baseName, count) {
        const usernames = [];
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let i = 0; i < count; i++) {
            const prefix = letters[Math.floor(Math.random() * letters.length)] + Math.floor(Math.random() * 9) + 1;
            usernames.push(`${prefix}_${baseName}`);
        }
        return usernames;
    }

    function startRandomMovement(bot) {
        function moveRandomly() {
            if (!bot.entity) return;

            const directions = ['forward', 'back', 'left', 'right'];
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const duration = 1000 + Math.random() * 2000;

            bot.setControlState(direction, true);
            setTimeout(() => {
                bot.setControlState(direction, false);
                moveRandomly();
            }, duration);
        }

        moveRandomly();
    }

    function startHeadMovement(bot) {
        function moveHeadRandomly() {
            if (!bot.entity) return;

            const yaw = (Math.random() - 0.5) * 2 * Math.PI; // Aleatorio entre -π y π
            const pitch = (Math.random() - 0.5) * Math.PI; // Aleatorio entre -π/2 y π/2

            bot.look(yaw, pitch, true, moveHeadRandomly);
        }

        moveHeadRandomly();
    }

    function controlMenu() {
        while (true) {
            const botNames = Object.keys(bots);
            if (botNames.length === 0) {
                console.log("No hay bots conectados para controlar.");
                break;
            }

            console.log('\n--- Menú de Control de Bots ---');
            botNames.forEach((botName, index) => {
                console.log(`${index + 1}. Controlar bot: ${botName}`);
            });
            console.log(`${botNames.length + 1}. Salir`);

            const choice = parseInt(readlineSync.question('\nSelecciona un bot para controlar o salir: '));

            if (choice > 0 && choice <= botNames.length) {
                const selectedBot = bots[botNames[choice - 1]];
                botControl(selectedBot);
            } else if (choice === botNames.length + 1) {
                break;
            } else {
                console.log('Opción no válida.');
            }
        }
    }

    function botControl(bot) {
        while (true) {
            console.log(`\n--- Controlando bot: ${bot.username} ---`);
            console.log('1. Enviar mensaje de chat');
            console.log('2. Mover hacia adelante');
            console.log('3. Saltar');
            console.log('4. Salir al menú principal');

            const action = parseInt(readlineSync.question('\nSelecciona una acción: '));

            if (action === 1) {
                const message = readlineSync.question('Ingresa el mensaje para enviar: ');
                bot.chat(message);
            } else if (action === 2) {
                bot.setControlState('forward', true);
                setTimeout(() => bot.setControlState('forward', false), 1000);
            } else if (action === 3) {
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 500);
            } else if (action === 4) {
                break;
            } else {
                console.log('Opción no válida.');
            }
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function connectBotsSequentially(usernames, host, port, password, messageToSend) {
        const proxies = getProxies();

        for (let i = 0; i < usernames.length; i++) {
            const username = usernames[i];
            const proxy = proxies[i % proxies.length];  // Asignar proxies de forma cíclica si hay menos proxies que bots

            console.log(`Intentando conectar: ${username}`);
            createBot(username, host, port, password, messageToSend, proxy);
            await delay(2000);  // Espera de 0.5 segundos entre cada conexión
            console.log('------------------------------------------');
        }
    }

    console.log(gradient.morning(`
    ╔════════════════════════════════════════════════════════╗
    ║                   Bot Minecraft Massive !               ║
    ║                      Programmed by Thods                ║
    ╚════════════════════════════════════════════════════════╝
    `));

    const baseName = readlineSync.question('Ingresa el nombre base (por ejemplo, Titanes): ');
    const userCount = parseInt(readlineSync.question('Ingresa la cantidad de usuarios a conectar: '));
    const host = readlineSync.question('Ingresa la IP del servidor: ');
    const port = parseInt(readlineSync.question('Ingresa el puerto del servidor: '));
    const password = readlineSync.question('Ingresa la contraseña para el registro: ');
    const messageToSend = readlineSync.question('Ingresa el mensaje que quieres que envíen los bots: ');

    checkServerStatus(host, port, async (isOnline) => {
        if (isOnline) {
            const usernames = generateUsernames(baseName, userCount);
            await connectBotsSequentially(usernames, host, port, password, messageToSend);
            controlMenu();
        } else {
            console.log('El servidor parece estar fuera de línea. No se pueden conectar los bots.');
        }
    });
})();
