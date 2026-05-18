const { Client } = require('discord.js-selfbot-v13');
const { Streamer, prepareStream, playStream } = require('@dank074/discord-video-stream');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const { execFile } = require('child_process');

// Nous forçons la désactivation du ffmpeg-static fourni par node_modules
// afin de laisser le serveur Pterodactyl utiliser SON propre FFmpeg (Linux natif).
// if (ffmpegPath) {
//     process.env.PATH = path.dirname(ffmpegPath) + path.delimiter + process.env.PATH;
// }

// Récupération des arguments envoyés par le Bot Python
const [, , guildId, channelId, videoName] = process.argv;

if (!guildId || !channelId || !videoName) {
    console.error("Arguments manquants !");
    process.exit(1);
}

const client = new Client({ checkUpdate: false });
const streamer = new Streamer(client);

// ==========================================
// VÉRIFICATION DU FICHIER AVANT CONNEXION
// ==========================================
console.log(`[PROJECTEUR] Recherche du fichier pour : ${videoName}`);
const possiblePaths = [
    path.join(__dirname, 'films', videoName),
    path.join(__dirname, videoName),
    path.join(__dirname, 'films', videoName + '.mp4'),
    path.join(__dirname, 'films', videoName + '.MP4'),
    path.join(__dirname, 'films', videoName + '.mkv'),
    path.join(__dirname, 'films', videoName + '.avi'),
    path.join(__dirname, 'films', videoName + '.AVI'),
    path.join(__dirname, videoName + '.mp4'),
    path.join(__dirname, videoName + '.MP4'),
    path.join(__dirname, videoName + '.mkv'),
    path.join(__dirname, videoName + '.avi'),
    path.join(__dirname, videoName + '.AVI')
];

let filePath = null;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        filePath = p;
        break;
    }
}

if (!filePath) {
    console.error(`[PROJECTEUR] Erreur : Fichier vidéo introuvable pour "${videoName}" ! (Vérifiez les majuscules et l'extension)`);
    process.exit(1);
}

console.log(`[PROJECTEUR] Fichier trouvé : ${filePath}`);

const onReady = async () => {
    console.log(`[PROJECTEUR] Connecté sous le compte projectionniste : ${client.user.tag}`);
    // Sécurité au cas où l'évenement est déclenché deux fois
    if (client.alreadyJoined) return;
    client.alreadyJoined = true;


    try {
        console.log(`[PROJECTEUR] Entrée dans le salon vocal ${channelId}...`);
        await streamer.joinVoice(guildId, channelId);

        console.log(`[PROJECTEUR] Lancement de l'encodage hybride V6...`);
        // 1. FFmpeg transforme le MP4 (souvent HEVC/H.265) en H.264 compatible Discord !
        // Puisque noTranscoding casse les fichiers HEVC (ton fichier FAST1), on doit ré-encoder.
        // Mais cette fois, on encode en 60 FPS HD avec un preset ultrafast pour ne pas laguer !
        const { output } = await prepareStream(filePath, {
            width: 854, // Résolution DVD (480p) : 0 lag, idéal pour streaming Node
            height: 480,
            frameRate: 24,
            bitrateVideo: 1500, // Débit faible pour éviter le crash Davey
            bitrateAudio: 128,
            hardwareAcceleratedDecoding: false, // On désactive pour éviter le décalage (desync) lié au GPU
            minimizeLatency: true,
            customFfmpegFlags: [] 
        });

        console.log(`[PROJECTEUR] Partage d'écran en cours...`);
        // 2. on lit le flux .nut avec le nouveau playStream (en mode "go-live")
        await playStream(output, streamer, { type: 'go-live' });

    } catch (e) {
        console.error("======================================");
        console.error("[PROJECTEUR] ERREUR CRITIQUE PENDANT LA DIFFUSION :");
        console.error(e);
        console.error("======================================");
        process.exit(1);
    }
};

client.on('ready', onReady);
client.on('clientReady', onReady);

client.on('debug', (info) => console.log(`[DEBUG] ${info}`));
client.on('error', (err) => console.error(`[ERROR] `, err));

// ===============================================================
// ⚠️ CE TOKEN DOIT ÊTRE UN FAUX COMPTE (LE PROJECTIONNISTE) ⚠️
const TOKEN_PROJECTIONNISTE = 'MTQ5NTUyMjczMzAyNTUyOTkxNw.Gsz-se.lO6aPgkwWl3a-9uNpd-z8ea8SvnavhOSiInwzo';
// ===============================================================

console.log("[PROJECTEUR] Tentative de connexion à Discord...");
client.login(TOKEN_PROJECTIONNISTE).then(() => {
    console.log("[PROJECTEUR] login() terminé avec succès");
}).catch(err => {
    console.error("[PROJECTEUR] Erreur de login() :", err);
});
