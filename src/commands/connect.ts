import tunnel from 'tunnel-ssh';
import open from "open";
import { Config } from 'tunnel-ssh';

import { ConnectInterface } from "../debugging/DebuggingInterface";
import { DebuggingClient } from "../debugging/DebuggingClient"

import * as Global from "../Global";

type Tunnel = { port: number, server: any };

function openTunnel(config: tunnel.Config) {
    return tunnel({ ...config, readyTimeout: Global.maxTimeSSHConnection });
}

export async function connect(connectConfig: Config) {
    let tunnels: Tunnel[] = [];

    console.log("Establishing remote connection...");

    openTunnel({ ...connectConfig, dstPort: Global.serverPort, localPort: Global.clientPort })
    .on("error", (err) => {
        console.error("Error: " + err.message)
        console.error("A Haxball Server connection could not be opened.");
        process.exit();
    });

    const client = new DebuggingClient();

    client.on("set", async (rooms) => {
        for (const room of rooms) {
            const tunnelSrv = openTunnel({ ...connectConfig, dstPort: room.server, localPort: room.client })

            tunnels.push({ port: room.client, server: tunnelSrv });
        }

        const url = new ConnectInterface().listen(Global.expressPort, Global.wsPort, client);

        await open(url);
    });

    client.on("add", async (server, client) => {
        const tunnelSrv = openTunnel({ ...connectConfig, dstPort: server, localPort: client })
        .on("error", (err) => {
            console.error("Error: " + err.message)
            console.error("Failed to connect to room.");
        });

        tunnels.push({ port: client, server: tunnelSrv });
    });

    client.on("remove", async (server, client) => {
        const tunnel = tunnels.find(t => t.port === client);

        if (tunnel) {
            tunnel.server?.close();
            tunnels = tunnels.filter(t => t.port !== tunnel.port);
        }
    });

    client.listen(Global.clientPort);
}