"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerPainel = void 0;
const Discord = __importStar(require("discord.js"));
const node_os_utils_1 = __importDefault(require("node-os-utils"));
const fs_1 = __importDefault(require("fs"));
const pidusage_1 = __importDefault(require("pidusage"));
const process_1 = __importDefault(require("process"));
class ServerPainel {
    constructor(_server, config) {
        this._server = _server;
        this._client = new Discord.Client();
        this._cpu = node_os_utils_1.default.cpu;
        this._mem = node_os_utils_1.default.mem;
        this._prefix = config.discordPrefix;
        this._token = config.discordToken;
        this._mastersDiscordId = config.mastersDiscordId;
        this._bots = config.bots;
        this._client.on('ready', () => {
            var _a;
            console.log(`Logged in as ${(_a = this._client.user) === null || _a === void 0 ? void 0 : _a.tag}!`);
        });
        this._client.on('message', async (msg) => {
            try {
                this._command(msg);
            }
            catch (e) {
                this._logError(e, msg.channel);
            }
        });
        this._client.login(this._token);
    }
    async _logError(e, channel) {
        const embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle("Log Error")
            .setTimestamp(Date.now())
            .setDescription(e);
        await channel.send(embed);
    }
    async _getRoomNameList() {
        var _a;
        let rooms = [];
        for (const browser of this._server.browsers) {
            const page = (await browser.pages())[0];
            const proxyServer = browser["proxyServer"];
            rooms.push({ name: `${await page.title()} (${(_a = page.browser().process()) === null || _a === void 0 ? void 0 : _a.pid})`, proxy: proxyServer });
        }
        if (rooms.length === 0)
            return "There are no open rooms!";
        if (rooms.every(r => r.proxy == null))
            return rooms.map(r => r.name).join("\n");
        let proxyRooms = [];
        for (const room of rooms) {
            let pRoom = proxyRooms.find(r => r.proxy === room.proxy);
            if (pRoom) {
                pRoom.text += room.name + "\n";
            }
            else {
                proxyRooms.push({ text: room.name + "\n", proxy: room.proxy });
            }
        }
        return proxyRooms.map(r => `• ${r.proxy}\n${r.text}`).join("\n");
    }
    async _getRoomUsageList() {
        var _a;
        const roomsUsage = [];
        for (const browser of this._server.browsers) {
            const page = (await browser.pages())[0];
            roomsUsage.push({ process: await pidusage_1.default((_a = browser === null || browser === void 0 ? void 0 : browser.process()) === null || _a === void 0 ? void 0 : _a.pid), title: await page.title() });
        }
        return roomsUsage;
    }
    async _command(msg) {
        var _a;
        if (!msg.content.startsWith(this._prefix))
            return;
        const args = msg.content.slice(this._prefix.length).trim().split(' ');
        const text = msg.content.slice(this._prefix.length).trim().replace(args[0] + " ", "");
        const command = (_a = args.shift()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        const embed = new Discord.MessageEmbed().setColor('#0099ff');
        if (this._mastersDiscordId.includes(msg.author.id)) {
            if (command === "help") {
                embed
                    .setTitle("Help")
                    .setDescription("Haxball Server is a small server utility for Haxball rooms.")
                    .addField("help", "Command list.", true)
                    .addField("info", "Server info.", true)
                    .addField("meminfo", "CPU and memory info.", true)
                    .addField("open", "Open a room.", true)
                    .addField("close", "Close a room.", true)
                    .addField("exit", "Close the server.", true)
                    .addField("eval", "Execute Javascript.", true)
                    .addField("tokenlink", "Haxball Headless Token page.", true);
                msg.channel.send(embed);
            }
            if (command === "tokenlink") {
                embed
                    .setTitle("Headless Token")
                    .setDescription(`[Click here.](https://www.haxball.com/headlesstoken)`);
                msg.channel.send(embed);
            }
            if (command === "open") {
                embed.setTitle("Open room");
                const token = text.replace(args[0] + " ", "").replace(/\"/g, "").replace("Token obtained: ", "");
                if (!Object.keys(this._bots).includes(args[0])) {
                    embed.setDescription(`This bot does not exist. Type ${this._prefix}info to see the list of available bots.`);
                    return msg.channel.send(embed);
                }
                if (!token) {
                    embed.setDescription(`You have to define a headless token [token](https://www.haxball.com/headlesstoken) as second argument: ${this._prefix}open <bot> <token>`);
                }
                fs_1.default.readFile(this._bots[args[0]], { encoding: 'utf-8' }, async (err, data) => {
                    if (err) {
                        embed.setDescription("Error: " + err);
                    }
                    else {
                        try {
                            const e = await this._server.open(data, token);
                            embed.setDescription(`Room running! [Click here to join.](${e === null || e === void 0 ? void 0 : e.link})\nBrowser process: ${e === null || e === void 0 ? void 0 : e.pid}`);
                        }
                        catch (e) {
                            embed.setDescription(`Unable to open the room!\n ${e}`);
                        }
                    }
                    msg.channel.send(embed);
                });
            }
            if (command === "info") {
                const roomList = await this._getRoomNameList();
                const files = Object.keys(this._bots);
                embed
                    .setTitle("Information")
                    .addField("Open rooms", roomList)
                    .addField("Bot list", files.join("\n"));
                msg.channel.send(embed);
            }
            if (command === "meminfo") {
                const embedLoading = new Discord.MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle("Information")
                    .setDescription("Loading...");
                const message = await msg.channel.send(embedLoading);
                const roomsUsage = await this._getRoomUsageList();
                const memInfo = await this._mem.info();
                const cpuUsage = await this._cpu.usage();
                embed
                    .setTitle("Information")
                    .addField("CPUs", this._cpu.count(), true)
                    .addField("CPU usage", cpuUsage + "%", true)
                    .addField("Free CPU", 100 - cpuUsage + "%", true)
                    .addField("Memory", `${(memInfo.usedMemMb / 1000).toFixed(2)}/${(memInfo.totalMemMb / 1000).toFixed(2)} GB (${memInfo.freeMemPercentage}% livre)`, true)
                    .addField("OS", await node_os_utils_1.default.os.oos(), true)
                    .addField("Machine Uptime", new Date(node_os_utils_1.default.os.uptime() * 1000).toISOString().substr(11, 8), true);
                const serverPIDUsage = await pidusage_1.default(process_1.default.pid);
                const serverCPUUsage = `CPU server usage: ${(serverPIDUsage.cpu).toFixed(2)}%\nMemory server usage: ${(serverPIDUsage.memory * 1e-6).toFixed(2)} MB\n`;
                const roomCPUMessage = this._server.browsers.length > 0 ? "\n" + roomsUsage.map((room) => `**${room.title} (${room.process.pid})**:\n${(room.process.cpu).toFixed(2)}% CPU\n${(room.process.memory * 1e-6).toFixed(2)} MB memory\n`).join("\n") : "";
                embed.setDescription(serverCPUUsage + roomCPUMessage + "\n");
                message.edit(embed);
            }
            if (command === "close") {
                embed
                    .setTitle("Close room")
                    .setDescription("Unable to find room");
                const res = await this._server.close(text);
                if (res) {
                    embed.setDescription("Room closed!");
                }
                msg.channel.send(embed);
            }
            if (command === "exit") {
                embed
                    .setTitle("Closing")
                    .setDescription("Closing server...");
                await msg.channel.send(embed);
                this._server.browsers.forEach(async (browser) => {
                    await browser.close();
                });
                process_1.default.exit();
            }
            if (command === "eval") {
                try {
                    const code = args.join(" ");
                    let evaled = eval(code);
                    if (typeof evaled !== "string")
                        evaled = require("util").inspect(evaled);
                    msg.channel.send(evaled, { code: "javascript", split: true });
                }
                catch (err) {
                    msg.channel.send(`\`ERROR\` \`\`\`xl\n${err}\n\`\`\``);
                }
            }
        }
    }
}
exports.ServerPainel = ServerPainel;
//# sourceMappingURL=painel.js.map