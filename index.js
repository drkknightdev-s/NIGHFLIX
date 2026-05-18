const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const { spawn } = require('child_process');
const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: true }));

const USAGE_FILE = 'usage.json';

// =================================================================
// ⚙️ CONFIGURATION DES IDS DE RÔLES PREMIUM ⚙️
// =================================================================
const ROLE_ID_OR = '1496133336463048827';
const ROLE_ID_ARGENT = '1496133133937152061';
const ROLE_ID_BRONZE = '1495507402299146250';

// =================================================================
// ⚙️ ROLE ADMINISTRATEUR POUR LE CATALOGUE ⚙️
// =================================================================
const ROLE_ID_ADMIN = '1494745219793420318'; // Remplacez par l'ID du rôle admin autorisé à utiliser /admin_add_catalogue

const CATALOGUE_FILE = 'catalogue.json';

function getCatalogue() {
    if (!fs.existsSync(CATALOGUE_FILE)) return [];
    try {
        const data = fs.readFileSync(CATALOGUE_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function saveCatalogue(catalogue) {
    fs.writeFileSync(CATALOGUE_FILE, JSON.stringify(catalogue, null, 4), 'utf8');
}

function getLimitForUser(member) {
    let limit = 10;
    if (!member || !member.roles) return limit;

    if (member.roles.cache.has(ROLE_ID_OR)) return 2500;
    if (member.roles.cache.has(ROLE_ID_ARGENT)) return 300;
    if (member.roles.cache.has(ROLE_ID_BRONZE)) return 50;

    return limit;
}

function getUsage() {
    if (!fs.existsSync(USAGE_FILE)) return {};
    try {
        const data = fs.readFileSync(USAGE_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

function saveUsage(usage) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 4), 'utf8');
}

function checkAndUpdateUsage(member) {
    const usage = getUsage();
    // Utiliser la date locale au format YYYY-MM-DD
    const today = new Date().toLocaleDateString('en-CA');
    const uid = member.id;

    if (!usage[uid] || usage[uid].date !== today) {
        usage[uid] = { date: today, count: 0 };
    }

    const limit = getLimitForUser(member);

    if (usage[uid].count >= limit) {
        return { allowed: false, count: usage[uid].count, limit };
    }

    usage[uid].count += 1;
    saveUsage(usage);
    return { allowed: true, count: usage[uid].count, limit };
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const activeProjectors = {};

client.once('ready', async () => {
    console.log(`Connecte en tant que ${client.user.tag} !`);
    client.user.setActivity('Nightflix', { type: ActivityType.Playing });

    const commands = [
        {
            name: 'help',
            description: "🎬 Affiche le menu d'aide Nightflix."
        },
        {
            name: 'premium',
            description: "💎 Affiche les options d'abonnement Nightflix."
        },
        {
            name: 'start_film',
            description: "🎬 Affiche le selecteur pour lancer un film."
        },
        {
            name: 'stop_film',
            description: '⏹️ Arrete le film en cours.'
        },
        {
            name: 'avis',
            description: "⭐ Laissez votre avis sur Nightflix !",
            options: [
                {
                    name: 'bot', description: 'Note globale du bot (sur 5)', type: 4, required: true,
                    choices: [{ name: '1 ⭐', value: 1 }, { name: '2 ⭐⭐', value: 2 }, { name: '3 ⭐⭐⭐', value: 3 }, { name: '4 ⭐⭐⭐⭐', value: 4 }, { name: '5 ⭐⭐⭐⭐⭐', value: 5 }]
                },
                {
                    name: 'developpeur', description: 'Avis sur le developpeur (sur 5)', type: 4, required: true,
                    choices: [{ name: '1 ⭐', value: 1 }, { name: '2 ⭐⭐', value: 2 }, { name: '3 ⭐⭐⭐', value: 3 }, { name: '4 ⭐⭐⭐⭐', value: 4 }, { name: '5 ⭐⭐⭐⭐⭐', value: 5 }]
                },
                {
                    name: 'son', description: 'Qualite du son (sur 5)', type: 4, required: true,
                    choices: [{ name: '1 ⭐', value: 1 }, { name: '2 ⭐⭐', value: 2 }, { name: '3 ⭐⭐⭐', value: 3 }, { name: '4 ⭐⭐⭐⭐', value: 4 }, { name: '5 ⭐⭐⭐⭐⭐', value: 5 }]
                },
                {
                    name: 'image', description: 'Qualite de l\'image (sur 5)', type: 4, required: true,
                    choices: [{ name: '1 ⭐', value: 1 }, { name: '2 ⭐⭐', value: 2 }, { name: '3 ⭐⭐⭐', value: 3 }, { name: '4 ⭐⭐⭐⭐', value: 4 }, { name: '5 ⭐⭐⭐⭐⭐', value: 5 }]
                },
                {
                    name: 'commentaire', description: 'Votre commentaire detaille', type: 3, required: true
                }
            ]
        },
        {
            name: 'catalogue',
            description: "🍿 Affiche le catalogue Nightflix des nouveautes Films et Series."
        },
        {
            name: 'admin_add_catalogue',
            description: "🚨 Ajoute un element au catalogue (Staff uniquement).",
            options: [
                { name: 'titre', description: 'Titre du film ou de la serie', type: 3, required: true },
                { name: 'type', description: 'Type de contenu', type: 3, required: true, choices: [{ name: 'Film', value: 'Film' }, { name: 'Serie', value: 'Serie' }] },
                { name: 'description', description: 'Synopsis courte', type: 3, required: true },
                { name: 'episodes', description: 'Liste des episodes separes par des virgules (si Serie)', type: 3, required: false },
                { name: 'image_url', description: 'URL de l\'affiche (optionnel)', type: 3, required: false }
            ]
        },
        {
            name: 'admin_remove_catalogue',
            description: "🗑️ Supprime un élément du catalogue (Staff uniquement).",
            options: [
                { name: 'titre', description: 'Titre exact du film ou de la série à supprimer', type: 3, required: true }
            ]
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log("Commandes Slash synchronisées !");
    } catch (e) {
        console.error(e);
    }
});

client.on('interactionCreate', async interaction => {
    // ============================================
    // GESTION DU MENU DEROULANT
    // ============================================
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_film') {
        const film = interaction.values[0];
        const member = interaction.member;

        if (!member.voice || !member.voice.channel) {
            await interaction.reply({ content: "❌ Vous devez être dans un salon vocal pour lancer le projecteur.", ephemeral: true });
            return;
        }

        const { allowed, count, limit } = checkAndUpdateUsage(member);
        if (!allowed) {
            const limitEmbed = new EmbedBuilder()
                .setTitle("❌ Limite Atteinte")
                .setDescription(`Vous avez atteint votre limite de **${limit} films par jour** pour votre abonnement.`)
                .setColor(0xff4444);
            await interaction.reply({ embeds: [limitEmbed], ephemeral: true });
            return;
        }

        const guildId = interaction.guild.id;
        const channelId = member.voice.channel.id;

        if (activeProjectors[guildId]) {
            await interaction.reply({ content: "⚠️ Un film est déjà en cours de diffusion sur ce serveur !", ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("🎬 Film Démarré")
            .setDescription(`🍿 Le projecteur est allumé. Bon visionnage de **${film}** sur Nightflix !`)
            .setColor(0x2ECC71)
            .addFields({ name: "Statut", value: "🟢 En cours", inline: true })
            .setImage("https://i.imgur.com/7S8R9S5.png")
            .setThumbnail("https://i.imgur.com/8Q3y5Xy.png")
            .setFooter({ text: `Lance par ${interaction.user.username} • ${count}/${limit} aujourd'hui` });

        // On update le message contenant le menu déroulant avec le embed de démarrage
        await interaction.update({ content: `🚀 Démarrage de la diffusion...`, embeds: [embed], components: [] });

        try {
            const projectorProcess = spawn('node', ['projecteur.js', guildId, channelId, film], { stdio: 'inherit' });
            activeProjectors[guildId] = projectorProcess;

            projectorProcess.on('exit', () => {
                delete activeProjectors[guildId];
            });
        } catch (e) {
            console.error(`Erreur lancement projecteur: ${e}`);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle("🎬 Nightflix - Commandes Disponibles")
            .setDescription("🍿 Accédez à une expérience cinématographique premium directement sur Discord.")
            .setColor(0xE50914)
            .addFields(
                { name: "`/start_film`", value: "Affiche un sélecteur visuel pour choisir et lancer la diffusion", inline: false },
                { name: "`/stop_film`", value: "Arrête la diffusion en cours", inline: false },
                { name: "`/catalogue`", value: "Affiche le catalogue de films et séries", inline: false },
                { name: "`/avis`", value: "Publiez un avis sur le bot et la qualité", inline: false },
                { name: "`/premium`", value: "Affiche les offres Nightflix Premium", inline: false },
                { name: "`/admin_add_catalogue`", value: "Staff: Ajoute une nouvelle série ou un film.", inline: false }
            )
            .setImage("https://i.imgur.com/7S8R9S5.png")
            .setThumbnail("https://i.imgur.com/8Q3y5Xy.png")
            .setFooter({ text: `Demandé par ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    }

    else if (interaction.commandName === 'premium') {
        const embed = new EmbedBuilder()
            .setTitle("💎 Nightflix Premium")
            .setDescription("🚀 Passez à la vitesse supérieure et débloquez une expérience cinématographique illimitée.")
            .setColor(0xD4AF37)
            .addFields(
                { name: "🆓 Plan FREE", value: "• 10 films par jour\n• Qualité Standard\n• **Gratuit** (0€/mois)", inline: false },
                { name: "🥉 Plan BRONZE", value: "• 50 films par jour\n• Qualité HD\n• **5€/mois**", inline: false },
                { name: "🥈 Plan ARGENT", value: "• 300 films par jour\n• Qualité Ultra HD\n• **8€/mois**", inline: false },
                { name: "🥇 Plan OR", value: "• 2500 films par jour\n• Priorité Absolue\n• **10€/mois**", inline: false }
            )
            .setFooter({ text: "💳 Achetez le rôle correspondant sur le serveur pour activer vos avantages !" })
            .setImage("https://i.imgur.com/7S8R9S5.png")
            .setThumbnail("https://i.imgur.com/8Q3y5Xy.png");

        await interaction.reply({ embeds: [embed] });
    }

    else if (interaction.commandName === 'start_film') {
        const cat = getCatalogue();

        const options = [];
        const seenValues = new Set();

        for (const item of cat) {
            if (item.type === 'Film' || item.type === 'film') {
                const val = item.titre.substring(0, 100);
                if (!seenValues.has(val)) {
                    seenValues.add(val);
                    options.push({ emoji: '🎬', label: val, value: val, description: "Film complet" });
                }
            } else if (item.type === 'Serie' || item.type === 'Série' || item.type === 'S\u00E9rie') {
                if (item.episodes && item.episodes.length > 0) {
                    for (const ep of item.episodes) {
                        const val = ep.substring(0, 100);
                        if (!seenValues.has(val)) {
                            seenValues.add(val);
                            options.push({ emoji: '📺', label: val, value: val, description: `Épisode de ${item.titre.substring(0, 50)}` });
                        }
                    }
                }
            }
        }

        const menuOptions = options.slice(0, 25); // Discord limite à 25 choix par SelectMenu

        if (menuOptions.length === 0) {
            await interaction.reply({ content: "❌ Aucun film ou épisode n'est disponible dans le catalogue pour le moment.", ephemeral: true });
            return;
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_film')
                    .setPlaceholder('Choisissez un film ou un episode...')
                    .addOptions(menuOptions)
            );

        const embedSelector = new EmbedBuilder()
            .setTitle("🎬 ACCÈS NIGHTFLIX")
            .setDescription("🤔 Quel programme souhaitez-vous visionner aujourd'hui ?\n*Faites votre choix dans le menu déroulant ci-dessous.*")
            .setColor(0xE50914) // Rouge Netflix
            .setImage("https://i.imgur.com/7S8R9S5.png")
            .setThumbnail("https://i.imgur.com/8Q3y5Xy.png")
            .setFooter({ text: "Sélectionnez une option ci-dessous ⬇️" });

        await interaction.reply({ embeds: [embedSelector], components: [row] });
    }

    else if (interaction.commandName === 'stop_film') {
        const guildId = interaction.guild.id;

        if (activeProjectors[guildId]) {
            activeProjectors[guildId].kill();
            delete activeProjectors[guildId];

            const embed = new EmbedBuilder()
                .setTitle("⏹️ Film Arrêté")
                .setDescription("🛑 La diffusion a été interrompue manuellement.")
                .setColor(0xF1C40F)
                .setImage("https://i.imgur.com/7S8R9S5.png")
                .setThumbnail("https://i.imgur.com/8Q3y5Xy.png")
                .setFooter({ text: `Arrêté par ${interaction.user.username}` });

            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({ content: "❌ Aucun film n'est actuellement diffusé.", ephemeral: true });
        }
    }

    else if (interaction.commandName === 'avis') {
        const botScore = interaction.options.getInteger('bot');
        const devScore = interaction.options.getInteger('developpeur');
        const sonScore = interaction.options.getInteger('son');
        const imageScore = interaction.options.getInteger('image');
        const commentaire = interaction.options.getString('commentaire');

        const mkStars = (n) => "⭐".repeat(n);

        const embed = new EmbedBuilder()
            .setTitle(`🍿 NOUVEL AVIS NIGHTFLIX !`)
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`*" ${commentaire} " *`)
            .setColor(0xE50914) // Rouge Netflix
            .addFields(
                { name: "🤖 **BOT NIGHTFLIX**", value: mkStars(botScore), inline: true },
                { name: "👨‍💻 **DÉVELOPPEUR**", value: mkStars(devScore), inline: true },
                { name: "\u200B", value: "\u200B", inline: true }, // Espace vide pour forcer l'alignement
                { name: "🎧 **QUALITÉ SONORE**", value: mkStars(sonScore), inline: true },
                { name: "🖥️ **QUALITÉ D'IMAGE**", value: mkStars(imageScore), inline: true },
                { name: "\u200B", value: "\u200B", inline: true }
            )
            .setImage("https://i.imgur.com/7S8R9S5.png")
            .setThumbnail("https://i.imgur.com/8Q3y5Xy.png")
            .setFooter({ text: "Merci pour votre soutien ! L'équipe Nightflix 🎉", iconURL: "https://i.imgur.com/8Q3y5Xy.png" });

        await interaction.reply({ embeds: [embed] });
    }

    else if (interaction.commandName === 'catalogue') {
        const cat = getCatalogue();

        if (cat.length === 0) {
            await interaction.reply({ content: "Le catalogue est actuellement vide.", ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("🎬 CATALOGUE NIGHTFLIX 🎬")
            .setDescription("🍿 Voici les nouveautés disponibles sur votre service de streaming Discord privé :")
            .setColor(0xE50914)
            .setImage("https://i.imgur.com/7S8R9S5.png")
            .setThumbnail("https://i.imgur.com/8Q3y5Xy.png");

        for (const item of cat) {
            let desc = `*${item.description}*\n`;
            if ((item.type === 'Serie' || item.type === 'Série' || item.type === 'S\u00E9rie') && item.episodes && item.episodes.length > 0) {
                desc += `\n**📂 Épisodes (${item.episodes.length}) :**\n• ${item.episodes.slice(0, 5).join('\n• ')}`;
                if (item.episodes.length > 5) desc += `\n*... et ${item.episodes.length - 5} autres épisodes.*`;
            }
            embed.addFields({ name: `🎞️ ${item.titre} [${item.type}]`, value: desc, inline: false });
        }

        // On affiche l'image du dernier ajout si elle existe
        const lastWithImg = cat.slice().reverse().find(i => i.image);
        if (lastWithImg) embed.setImage(lastWithImg.image); // Override Image if catalogue has an item image

        await interaction.reply({ embeds: [embed] });
    }

    else if (interaction.commandName === 'admin_add_catalogue') {
        const member = interaction.member;

        // Vérification du rôle Administrateur
        if (!member.roles.cache.has(ROLE_ID_ADMIN)) {
            await interaction.reply({ content: "❌ Vous n'avez pas l'autorisation.", ephemeral: true });
            return;
        }

        const titre = interaction.options.getString('titre');
        const type = interaction.options.getString('type');
        const description = interaction.options.getString('description');
        const episodesRaw = interaction.options.getString('episodes') || "";
        const imageUrl = interaction.options.getString('image_url') || "";

        const episodes = (type === 'Serie' || type === 'Série') && episodesRaw.length > 0 ? episodesRaw.split(',').map(e => e.trim()) : [];

        const cat = getCatalogue();
        cat.push({
            titre,
            type: type, // Utilise le type passé en argument (Film ou Serie)
            description,
            image: imageUrl,
            episodes
        });
        saveCatalogue(cat);

        const embed = new EmbedBuilder()
            .setTitle("🚨 NOUVELLE MISE À JOUR DU CATALOGUE 🚨")
            .setDescription(`✨ Les nouveautés **${titre}** viennent d'être ajoutées au serveur 🔥`)
            .addFields({ name: "Synopsis", value: description })
            .setColor(0x2ECC71)
            .setImage("https://i.imgur.com/7S8R9S5.png")
            .setThumbnail("https://i.imgur.com/8Q3y5Xy.png");

        if (episodes.length > 0) {
            embed.addFields({ name: `📂 Épisodes disponibles (${episodes.length}) :`, value: `• ${episodes.join('\n• ')}` });
        }
        if (imageUrl) embed.setImage(imageUrl); // Override with specific poster if provided

        embed.addFields({ name: "👀", value: "N'hésitez pas à donner vos retours ou demander la suite !" });

        await interaction.reply({ content: "@everyone 🚨 NOUVEAUTÉ NIGHTFLIX 🚨", embeds: [embed] });
    }

    else if (interaction.commandName === 'admin_remove_catalogue') {
        const member = interaction.member;

        // Vérification du rôle Administrateur
        if (!member.roles.cache.has(ROLE_ID_ADMIN)) {
            await interaction.reply({ content: "❌ Vous n'avez pas l'autorisation.", ephemeral: true });
            return;
        }

        const titre = interaction.options.getString('titre');
        let cat = getCatalogue();

        const initialLength = cat.length;
        // On supprime l'élément (en ignorant la casse pour faciliter la suppression)
        cat = cat.filter(item => item.titre.toLowerCase() !== titre.toLowerCase());

        if (cat.length === initialLength) {
            await interaction.reply({ content: `❌ Aucun film ou série n'a été trouvé avec le titre **${titre}**. Vérifiez l'orthographe !`, ephemeral: true });
            return;
        }

        saveCatalogue(cat);

        const embed = new EmbedBuilder()
            .setTitle("🗑️ SUPPRESSION DU CATALOGUE")
            .setDescription(`✅ Le contenu **${titre}** a été retiré du catalogue avec succès.`)
            .setColor(0xE74C3C) // Rouge clair
            .setThumbnail("https://i.imgur.com/8Q3y5Xy.png");

        await interaction.reply({ embeds: [embed], ephemeral: true }); // On le met en éphémère pour ne pas polluer le chat général
    }
});

// =================================================================
// 🛑 METTEZ LE TOKEN DE VOTRE VRAI BOT CI-DESSOUS 🛑
// =================================================================
const TOKEN_BOT = "you token bot";

client.login(TOKEN_BOT);

// =================================================================
// 💰 SERVEUR EXPRESS POUR PAYPAL IPN 💰
// =================================================================
app.post('/paypal-ipn', async (req, res) => {
    // 1. Répondre 200 OK immédiatement à PayPal
    res.sendStatus(200);

    const body = req.body || {};

    // 2. Préparer la réponse pour valider l'IPN auprès de PayPal
    const payload = new URLSearchParams();
    payload.append('cmd', '_notify-validate');
    for (const key in body) {
        payload.append(key, body[key]);
    }

    // Environnement Sandbox ou Live
    const paypalURL = body.test_ipn === '1'
        ? 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr'
        : 'https://ipnpb.paypal.com/cgi-bin/webscr';

    try {
        // 3. Envoyer la requête de vérification
        const response = await fetch(paypalURL, {
            method: 'POST',
            body: payload,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();

        if (text === 'VERIFIED') {
            console.log("✅ IPN PayPal Vérifié ! Transaction reçue.");

            const paymentStatus = body.payment_status;
            // ⚠️ TRES IMPORTANT : L'ID Discord doit être envoyé via le champ "custom" lors de la création du bouton de paiement
            const discordUserId = body.custom;
            const amount = parseFloat(body.mc_gross);

            if (paymentStatus === 'Completed' && discordUserId) {
                // Optionnel : remplacez par l'ID de votre serveur si le bot est sur plusieurs serveurs.
                // Sinon on prend le premier serveur où le bot est présent.
                const guild = client.guilds.cache.first();

                if (guild) {
                    try {
                        const member = await guild.members.fetch(discordUserId);

                        // 4. Attribuer le rôle selon le montant payé
                        if (amount == 5.00) {
                            await member.roles.add(ROLE_ID_BRONZE);
                            member.send("🎉 Merci pour votre achat ! Vous avez reçu le plan BRONZE avec 50 films/jour.").catch(() => { });
                            console.log(`Plan BRONZE attribué à ${member.user.tag}`);
                        } else if (amount == 8.00) {
                            await member.roles.add(ROLE_ID_ARGENT);
                            member.send("🎉 Merci pour votre achat ! Vous avez reçu le plan ARGENT avec 300 films/jour.").catch(() => { });
                            console.log(`Plan ARGENT attribué à ${member.user.tag}`);
                        } else if (amount == 10.00) {
                            await member.roles.add(ROLE_ID_OR);
                            member.send("🎉 Merci pour votre achat ! Vous avez reçu le plan OR avec 2500 films/jour.").catch(() => { });
                            console.log(`Plan OR attribué à ${member.user.tag}`);
                        } else {
                            console.log(`Montant de ${amount}€ ne correspond à aucun plan.`);
                        }
                    } catch (err) {
                        console.error("Impossible de trouver le membre sur le serveur Discord. ID:", discordUserId);
                    }
                }
            }
        } else {
            console.error("❌ IPN Invalide refusé par PayPal :", text);
        }
    } catch (error) {
        console.error("Erreur lors de la vérification IPN :", error);
    }
});

// 👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇👇
// 👉 LA LIGNE POUR CHANGER LE PORT EST JUSTE ICI :
const PORT = process.env.PORT || 3000;
// 👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆

app.listen(PORT, () => {
    console.log(`🚀 Serveur IPN PayPal en écoute sur le port ${PORT}`);
    console.log(`🌐 L'URL de votre Webhook PayPal est : http://VOTRE-IP:${PORT}/paypal-ipn`);
});
