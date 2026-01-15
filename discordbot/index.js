// index.js
require('dotenv').config();

const DISCORD_BOT_TOKEN = 'MTQ2MTQ1MzE4NzA5MjQ1MTM0OA.GTxFic.leMIuATghtq9ZCFJefo5eI71y9hC8oGWICyAYo';
const DISCORD_APPLICATION_ID = '1461453187092451348';
const DISCORD_GUILD_ID = '1461452356246831227';
const SUPABASE_URL = 'https://zffkhagmwtmqbqkxceun.supabase.co';
const SUPABASE_API_KEY = 'sb_publishable_y3uJ-a-F2Pn7lzxyuG3lsg_eLbynSN4';
const JWT_SECRET = 'ff23a596-350e-4720-a586-3c60cd366354';


const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, REST, Routes } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

// ID roli "klient"
const CLIENT_ROLE_ID = '1461452356246831236';

// Komendy
const commands = [
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Rejestruj się za pomocą klucza i roli')
    .addStringOption(option =>
      option.setName('key')
        .setDescription('Podaj swój klucz')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('createkey')
    .setDescription('Generuje nowy klucz i zapisuje do bazy (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

// Rejestracja komend
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
rest.put(Routes.applicationGuildCommands(process.env.DISCORD_APPLICATION_ID, process.env.DISCORD_GUILD_ID), { body: commands })
  .then(() => console.log('✅ Komendy zarejestrowane!'))
  .catch(console.error);

// Obsługa komend
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const userId = interaction.user.id;

  // Komenda /register
  if (interaction.commandName === 'register') {
    const key = interaction.options.getString('key');

    // Pobranie klucza z Supabase
    const { data: keyData, error: keyError } = await supabase
      .from('keys')
      .select('*')
      .eq('key', key)
      .single();

    if (keyError || !keyData || keyData.used) {
      return interaction.reply({ content: '❌ Nieprawidłowy lub już użyty klucz!', ephemeral: true });
    }

    // Sprawdzenie czy użytkownik ma rolę "klient"
    if (!interaction.member.roles.cache.has(CLIENT_ROLE_ID)) {
      return interaction.reply({ content: '❌ Użytkownik nie ma wymaganej roli "klient".', ephemeral: true });
    }

    // Generowanie hasła
    const password = crypto.randomBytes(16).toString('hex');

    // Dodanie użytkownika do bazy
    const { error: insertError } = await supabase.from('passwords').insert([{
      password,
      hwid: userId,
      loggedIn: false,
      userID: userId
    }]);

    if (insertError) {
      console.error('Błąd dodawania do Supabase:', insertError);
      return interaction.reply({ content: '❌ Wystąpił błąd przy dodawaniu do bazy!', ephemeral: true });
    }

    // Oznaczenie klucza jako użytego
    const { error: updateError } = await supabase.from('keys').update({ used: true }).eq('key', key);
    if (updateError) {
      console.error('Błąd oznaczania klucza jako użytego:', updateError);
    }

    // Generowanie tokenu JWT
    const jwtToken = jwt.sign({ userId, username: interaction.user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await interaction.reply({
      content: `✅ Rejestracja zakończona! Twój token: \`${jwtToken}\``,
      ephemeral: true
    });
  }

  // Komenda /createkey
  if (interaction.commandName === 'createkey') {
    const newKey = crypto.randomBytes(8).toString('hex').toUpperCase();

    const { error: keyInsertError } = await supabase.from('keys').insert([{ key: newKey, used: false }]);

    if (keyInsertError) {
      console.error('Błąd tworzenia klucza:', keyInsertError);
      return interaction.reply({ content: '❌ Wystąpił błąd przy tworzeniu klucza!', ephemeral: true });
    }

    await interaction.reply({ content: `✅ Nowy klucz: \`${newKey}\``, ephemeral: true });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
