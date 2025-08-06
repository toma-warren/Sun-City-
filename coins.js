// ===============================
// 📌 БЛОК 1: ИМПОРТЫ И НАСТРОЙКИ
// ===============================
import { Client, GatewayIntentBits, EmbedBuilder,  ActionRowBuilder, ButtonBuilder, ButtonStyle,AttachmentBuilder} from 'discord.js';
import fs from 'fs';
import moment from 'moment';
import 'moment/locale/ru.js';

import canvas from 'canvas';
import { createCanvas, loadImage, registerFont } from 'canvas';
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// ===== ⚙️ Константы и пути к файлам =====
const prefix = '/';
const bonusRolesPath = './bonusRoles.json';
const dbPath = './coins.json';

// ===== 🎭 Идентификаторы ролей и каналов =====
const COINS_CHANNEL_ID = '1402007519991435324'; // Канал Коинов
const ADMIN_ROLE_ID = '1393554205880619028'; // Роли Админ дискорд/ГА/ЗГА/Кураторы
const MAIN_MOD_ROLE_ID = '1383801971714297927'; // Роли ГМ/Админ дискорд/ГА/ЗГА/Кураторы
const CUR_MOD_ROLE_ID = '1393534657106153482'; // Роль Кураторов модерации/ГМ/Админ дискорд/ГА/ЗГА/Кураторы
const MOD_ROLE_ID = '1383087454965207050'; // Роль модерации/Кураторов модерации/ГМ/Админ дискорд/ГА/ЗГА/Кураторы
const FAM_CATEGORY_ID = '1393535932807774290 '; // Заменить на ID категории(фамы)
const MOD_CONFIRM_CHANNEL_ID = '1393535980836753438'; // 💬 Канал подтверждения модерации(передача фамы)
const REFERENCE_ROLE_ID = '1401512311344205904'; //ID роли, под которой нужно размещать новую приватную роль
const FAM_ROLE_ID = '1401475495845036133'; // ID роли, под которую нужно переместить создаваемую роль семьи

// ===== 🎟️ Лотерея =====
const LOTTERY_ENTRY_COST = 100;
const INITIAL_PRIZE = 4000;

let lotteryMessage = null;
let lotteryInterval = null;
const lotteryParticipants = new Set();



// ===============================
// 📦 БЛОК 2: БАЗА ДАННЫХ И НАЧАЛО
// ===============================
let data = {
  coinsData: {},
  promocodes: {},
  privateRoles: {},
  disabledChannels: [],
};
if (fs.existsSync(dbPath)) {
  try {
    data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch (e) {
    console.error('Ошибка чтения базы:', e);
  }
}
if (!Array.isArray(data.disabledChannels)) data.disabledChannels = [];
// ===============================
// 🔧 БЛОК 3: ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ===============================
function checkExpiredFamilies() {
  const now = Date.now();

  for (const [roleId, fam] of Object.entries(data.families || {})) {
    const remaining = fam.expiresAt - now;

    if (remaining <= 0) {
      const guild = client.guilds.cache.first();
      const famChannel = guild.channels.cache.get(fam.channelId);
      const famRole = guild.roles.cache.get(roleId);

      if (famChannel) famChannel.delete().catch(() => {});
      if (famRole) famRole.delete().catch(() => {});

      delete data.families[roleId];
      saveData();

      client.users.fetch(fam.ownerId).then(user => {
        user.send({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('⏰ Семья удалена')
            .setDescription(`Ваша семья **[FAM] ${fam.name}** была удалена после окончания срока действия.`)
            .setTimestamp()
          ]
        }).catch(() => {});
      });

    } else if (remaining <= 3 * 24 * 60 * 60 * 1000 && !fam.warned) {
      client.users.fetch(fam.ownerId).then(user => {
        user.send({
          embeds: [new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle('⚠️ Срок действия семьи подходит к концу')
            .setDescription(`Ваша семья **[FAM] ${fam.name}** будет удалена через **3 дня**.`)
            .setTimestamp()
          ]
        }).catch(() => {});
      });

      fam.warned = true;
      saveData();
    }
  }
}
function saveData() {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  console.log('Данные сохранены');
}
function createEmbed({ title = '', description = '', color = '#6A5ACD', footerText = 'Arizona Sun-Ciry', timestamp = new Date() }) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: footerText })
    .setTimestamp(timestamp);
}
function sendError(message, text) {
  const embed = createEmbed({ title: '❌ Ошибка', description: text, color: '#FF5555' });
  return message.channel.send({ embeds: [embed] }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 7000));
}
function sendWarning(message, text) {
  const embed = createEmbed({ title: '⚠ Внимание', description: text, color: '#FFAA00' });
  return message.channel.send({ embeds: [embed] }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 7000));
}
function sendSuccess(message, text) {
  const embed = createEmbed({ title: '✅ Успешно', description: text, color: '#00CC66' });
  return message.channel.send({ embeds: [embed] });
}
function declOfNum(number, words) {
  number = Math.abs(number) % 100;
  const n1 = number % 10;
  if (number > 10 && number < 20) return words[2];
  if (n1 > 1 && n1 < 5) return words[1];
  if (n1 === 1) return words[0];
  return words[2];
}
function getStatus(coins) {
  if (coins >= 200000) return 'Абсолют';
  if (coins >= 150000) return 'Легендарный Ветеран';
  if (coins >= 100000) return 'Император';
  if (coins >= 75000) return 'Элита';
  if (coins >= 50000) return 'Легенда';
  if (coins >= 30000) return 'Эксперт';
  if (coins >= 20000) return 'Менеджер';
  if (coins >= 15000) return 'Стратег';
  if (coins >= 10000) return 'Активист';
  if (coins >= 7500) return 'Энтузиаст';
  if (coins >= 5000) return 'Участник';
  if (coins >= 2500) return 'Начинающий Профи';
  if (coins >= 1000) return 'Новичок';
  if (coins >= 100) return 'Гость';
  return 'Начинающий';
}
function saveBonusRoles(bonusRoles) {
  try {
    const toSave = {};
    for (const roleId in bonusRoles) {
      toSave[roleId] = { amount: bonusRoles[roleId].amount };
    }
    fs.writeFileSync(bonusRolesPath, JSON.stringify(toSave, null, 2), 'utf-8');
    console.log('Бонусные роли успешно сохранены');
  } catch (error) {
    console.error('Ошибка при сохранении bonusRoles.json:', error);
  }
}
function loadBonusRoles() {
  if (!fs.existsSync(bonusRolesPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(bonusRolesPath, 'utf-8'));
  } catch (error) {
    console.error('❌ Ошибка при чтении bonusRoles.json:', error);
    return {};
  }
}
function ensureDepositFields(userId) {
  if (!data.coinsData[userId].deposit) data.coinsData[userId].deposit = 0;
  if (!data.coinsData[userId].depositIncome) data.coinsData[userId].depositIncome = 0;
}
function createRoleNoticeEmbed(title, description, color) {
  return createEmbed({
    title,
    description,
    color,
    timestamp: new Date(),
    footerText: 'Если есть вопросы, свяжитесь с модерацией.',
  });
}
// ===============================
// 💬 БЛОК 4: ОБРАБОТКА СООБЩЕНИЙ (КОМАНД)
// ===============================
client.once('ready', () => {
  console.log(`✅ Бот запущен как ${client.user.tag}`);

  // Проверка просроченных фам каждые 10 минут
  setInterval(checkExpiredFamilies, 10 * 60 * 1000);
});
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const userId = message.author.id;
  if (!data.coinsData[userId]) {
    data.coinsData[userId] = {
      coins: 0,
      promocode: null,
      usedPromocode: null,
    };
    saveData();
  }
  if (message.channel.id === COINS_CHANNEL_ID) {
    if (!message.content.startsWith(prefix)) {
      await message.delete().catch(() => {});
      return;
    }
  }
if (!message.content.startsWith(prefix) && !data.disabledChannels.includes(message.channel.id)) {
  data.coinsData[userId].coins += 10;
  saveData();
}
   if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // ===============================
  // 💰 БЛОК 5: ЭКОНОМИЧЕСКИЕ КОМАНДЫ
  // ===============================

if (command === 'info') {
  if (message.channel.id !== COINS_CHANNEL_ID) {
    return message.delete().catch(() => {});
  }

  await message.delete().catch(() => {});

  const targetMember =
    message.mentions.members.first() ||
    message.guild.members.cache.get(args[0]) ||
    message.member;

  const targetUser = targetMember.user;
  const targetId = targetUser.id;

  if (!data.coinsData[targetId]) {
    data.coinsData[targetId] = {
      coins: 0,
      deposit: 0,
      depositIncome: 0,
      promocode: null,
      usedPromocode: null
    };
    saveData();
  }

  const userData = data.coinsData[targetId];
  const coins = userData.coins || 0;
  const deposit = userData.deposit || 0;
  const income = Math.floor(deposit * 0.005);
  const usedPromocode = userData.usedPromocode || 'Отсутствует';
  const status = getStatus(coins);

  const image = await generateUserInfoImage(
    targetUser,
    targetMember,
    coins,
    deposit,
    income,
    usedPromocode,
    status
  );

  const infoMsg = await message.channel.send({ files: [image] });
  setTimeout(() => infoMsg.delete().catch(() => {}), 60000);
}
async function generateUserInfoImage(user, member, coins, deposit, income, promocode, status) {
  const canvasWidth = 950;
  const canvasHeight = 460;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  function declOfNum(number, titles) {
    number = Math.abs(number) % 100;
    const n1 = number % 10;
    if (number > 10 && number < 20) return titles[2];
    if (n1 > 1 && n1 < 5) return titles[1];
    if (n1 === 1) return titles[0];
    return titles[2];
  }

  const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bgGradient.addColorStop(0, '#121417');
  bgGradient.addColorStop(1, '#25282f');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const noiseCanvas = createCanvas(canvasWidth, canvasHeight);
  const noiseCtx = noiseCanvas.getContext('2d');
  const imageData = noiseCtx.createImageData(canvasWidth, canvasHeight);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.random() * 30;
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 15;
  }
  noiseCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(noiseCanvas, 0, 0);

  const cardX = 40;
  const cardY = 40;
  const cardWidth = canvasWidth - 80;
  const cardHeight = canvasHeight - 80;
  const cardRadius = 30;

  ctx.shadowColor = 'rgba(255, 204, 53, 0.2)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#2a2d37cc';
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.fill();

  ctx.shadowBlur = 0;
  const borderGradient = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + cardHeight);
  borderGradient.addColorStop(0, '#f7dc6f');
  borderGradient.addColorStop(0.5, '#f39c12');
  borderGradient.addColorStop(1, '#f7dc6f');
  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 5;
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.stroke();

  const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
  const avatarX = 70;
  const avatarY = 140;
  const avatarSize = 180;

  ctx.shadowColor = 'rgba(247, 156, 18, 0.6)';
  ctx.shadowBlur = 20;
  ctx.roundRect(avatarX - 12, avatarY - 12, avatarSize + 24, avatarSize + 24, 24);
  ctx.fillStyle = '#191a1f';
  ctx.fill();
  ctx.shadowBlur = 0;

  const avatarBorderGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
  avatarBorderGrad.addColorStop(0, '#f7dc6f');
  avatarBorderGrad.addColorStop(1, '#f39c12');
  ctx.strokeStyle = avatarBorderGrad;
  ctx.lineWidth = 5;
  ctx.roundRect(avatarX - 12, avatarY - 12, avatarSize + 24, avatarSize + 24, 24);
  ctx.stroke();

  // Аватар (скругление)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 20);
  ctx.clip();
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  const coinWord = declOfNum(coins, ['коин', 'коина', 'коинов']);
  const depositWord = declOfNum(deposit, ['коин', 'коина', 'коинов']);
  const incomeWord = declOfNum(income, ['коин', 'коина', 'коинов']);

  const infoX = 280;
  const infoY = 160;
  const lineHeight = 48;

  ctx.font = '600 26px Arial';
  const infoItems = [
    ['👤 Имя пользователя', member.displayName],
    ['💰 Баланс пользователя', `${coins.toLocaleString('ru-RU')} ${coinWord}`],
    ['🏦 Депозит', `${deposit.toLocaleString('ru-RU')} ${depositWord}`],
    ['📈 Доход от депозита', `${income.toLocaleString('ru-RU')} ${incomeWord}`],
    ['🎟️ Промокод', promocode || 'Отсутствует'],
    ['📊 Статус', status]
  ];

  for (let i = 0; i < infoItems.length; i++) {
    const [label, value] = infoItems[i];
    const y = infoY + i * lineHeight;

    ctx.fillStyle = '#f7dc6f';
    ctx.shadowColor = 'rgba(247, 220, 111, 0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText(label + ':', infoX, y);

    const labelWidth = ctx.measureText(label + ':').width + 20;

    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';

    const valueGradient = ctx.createLinearGradient(infoX + labelWidth, y, infoX + labelWidth + 300, y);
    valueGradient.addColorStop(0, '#c9c6c6ff'); // светло-серый
    valueGradient.addColorStop(1, '#ffffff'); // белый для блика

    ctx.fillStyle = valueGradient;

    let displayValue = value;
    const maxWidth = cardWidth - (infoX + labelWidth) - 40;
    if (ctx.measureText(displayValue).width > maxWidth) {
      while (ctx.measureText(displayValue + '…').width > maxWidth) {
        displayValue = displayValue.slice(0, -1);
      }
      displayValue += '…';
    }

    ctx.fillText(displayValue, infoX + labelWidth, y);
    ctx.shadowBlur = 0;
  }

  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const title = 'Пользователь Sun City';
  const titleX = cardX + cardWidth / 2;
  const titleY = cardY + 50;

  const titleGradient = ctx.createLinearGradient(titleX - 150, titleY, titleX + 150, titleY);
  titleGradient.addColorStop(0, '#f7dc6f');
  titleGradient.addColorStop(1, '#f39c12');

  ctx.fillStyle = titleGradient;
  ctx.shadowColor = 'rgba(255, 198, 60, 0.9)';
  ctx.shadowBlur = 14;
  ctx.fillText(title, titleX, titleY);
  ctx.shadowBlur = 0;

  return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'profile.png' });
}
if (command === 'deposit') {
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});
  await message.delete().catch(() => {});

  if (!data.coinsData[userId].deposit) data.coinsData[userId].deposit = 0;
  if (!data.coinsData[userId].depositIncome) data.coinsData[userId].depositIncome = 0;

  const amount = parseInt(args[0]);

  if (isNaN(amount) || amount <= 0) {
    const error = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Ошибка')
        .setDescription('💡 Укажите корректную сумму для депозита.')
        .setColor('#FF0000')]
    });
    return setTimeout(() => error.delete().catch(() => {}), 30000);
  }

  if (data.coinsData[userId].coins < amount) {
    const error = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Недостаточно коинов')
        .setDescription('💸 У вас недостаточно коинов для депозита.')
        .setColor('#FF0000')]
    });
    return setTimeout(() => error.delete().catch(() => {}), 30000);
  }

  data.coinsData[userId].coins -= amount;
  data.coinsData[userId].deposit += amount;
  saveData();

  const confirm = await message.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('🏦 Депозит пополнен')
      .setDescription(`✅ Вы внесли **${amount.toLocaleString('ru-RU')}** коинов на депозит.`)
      .setColor('#00FF7F')]
  });
  setTimeout(() => confirm.delete().catch(() => {}), 30000);
}
if (command === 'withdraw') {
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});
  await message.delete().catch(() => {});

  if (!data.coinsData[userId].deposit) data.coinsData[userId].deposit = 0;
  if (!data.coinsData[userId].depositIncome) data.coinsData[userId].depositIncome = 0;

  const amount = parseInt(args[0]);

  if (isNaN(amount) || amount <= 0) {
    const error = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Ошибка')
        .setDescription('💡 Укажите корректную сумму для снятия.')
        .setColor('#FF0000')]
    });
    return setTimeout(() => error.delete().catch(() => {}), 30000);
  }

  if (data.coinsData[userId].deposit < amount) {
    const error = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Недостаточно средств')
        .setDescription('🏦 На вашем депозите недостаточно коинов для снятия.')
        .setColor('#FF0000')]
    });
    return setTimeout(() => error.delete().catch(() => {}), 30000);
  }

  data.coinsData[userId].deposit -= amount;
  data.coinsData[userId].coins += amount;
  saveData();

  const confirm = await message.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('💸 Снятие с депозита')
      .setDescription(`✅ Вы сняли **${amount.toLocaleString('ru-RU')}** коинов с депозита.`)
      .setColor('#00FF7F')]
  });
  setTimeout(() => confirm.delete().catch(() => {}), 30000);
}
else if (command === 'createpromo') {
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});

  const promoName = args[0]?.toLowerCase();

  if (!promoName) {
    return sendWarning(message, '❗ Укажи название промокода: `/createpromo <название>`');
  }

  if (!data.coinsData[userId]) {
    data.coinsData[userId] = {
      coins: 0,
      promocode: null,
      usedPromocode: null,
    };
  }

  if (data.coinsData[userId].promocode) {
    return sendWarning(message, `❗ У тебя уже есть промокод: \`${data.coinsData[userId].promocode}\``);
  }

  if (data.promocodes[promoName]) {
    return sendError(message, '❌ Такой промокод уже существует, выбери другое название.');
  }

  const cost = 5000;
  if (data.coinsData[userId].coins < cost) {
    return sendError(message, `❌ Недостаточно коинов. Стоимость создания: ${cost.toLocaleString('ru-RU')} коинов.`);
  }

  data.coinsData[userId].coins -= cost;
  data.coinsData[userId].promocode = promoName;
  data.promocodes[promoName] = {
    ownerId: userId,
    uses: 0,
  };

  saveData();

  const embed = createEmbed({
    title: '🎉 Промокод создан',
    description: `Ты создал промокод: \`${promoName}\` за **${cost.toLocaleString('ru-RU')}** коинов.`,
    color: '#00CC66',
    footerText: 'Теперь другие пользователи смогут использовать этот промокод!',
    timestamp: new Date(),
  });

  const sentMsg = await message.channel.send({ embeds: [embed] });
  await message.delete().catch(() => {});
  setTimeout(() => sentMsg.delete().catch(() => {}), 15000);
}
else if (command === 'promo') {
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});

  const promoName = args[0]?.toLowerCase();

  if (!promoName) {
    return sendWarning(message, '❗ Укажи промокод: `/promo <название>`');
  }

  const promo = data.promocodes[promoName];
  if (!promo) {
    return sendError(message, '❌ Такой промокод не найден.');
  }

  if (promo.ownerId === userId) {
    return sendError(message, '❌ Нельзя использовать свой собственный промокод.');
  }

  const bonus = 300;
  data.coinsData[userId].coins += bonus;
  promo.uses += 1;
  data.coinsData[userId].usedPromocode = promoName;

  saveData();

  const embed = createEmbed({
    title: '🎁 Промокод применён',
    description: `Ты получил бонус **+${bonus.toLocaleString('ru-RU')} коинов** за использование промокода \`${promoName}\`.`,
    color: '#0099FF',
  });

  const sentMsg = await message.channel.send({ embeds: [embed] });
  await message.delete().catch(() => {});
  setTimeout(() => sentMsg.delete().catch(() => {}), 15000);
}
else if (command === 'promocodes') {
  if (!message.member.roles.cache.has(MOD_ROLE_ID)) {
    return sendError(message, '❌ У вас нет прав для использования этой команды.');
  }

  await message.delete().catch(() => {});

  const allPromos = Object.entries(data.promocodes);
  if (allPromos.length === 0) {
    return sendSuccess(message, '😕 Промокоды отсутствуют.');
  }

  const chunkSize = 6;
  const page = 0; 

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof radius === 'number') {
      radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
      for (let side of ['tl', 'tr', 'br', 'bl']) {
        radius[side] = radius[side] || 0;
      }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  const canvasWidth = 1100;
  const rowHeight = 80;
  const headerHeight = 120;
  const footerHeight = 30;
  const sidePadding = 50;

  const makeEmbed = () => {
    const chunk = allPromos.slice(page * chunkSize, page * chunkSize + chunkSize);
    const canvasHeight = headerHeight + chunk.length * rowHeight + footerHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

 
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#1e2125');
    gradient.addColorStop(1, '#2e3238');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    
    const titleText = '📋 Список промокодов';
    ctx.font = 'bold 36px Sans';
    const titleWidth = ctx.measureText(titleText).width;
    const grad = ctx.createLinearGradient(sidePadding, 0, sidePadding + titleWidth, 0);
    grad.addColorStop(0, '#6a5acd');
    grad.addColorStop(1, '#483d8b');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(106, 90, 205, 0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(titleText, sidePadding, 50);
    ctx.shadowColor = 'transparent';

  
    const sepGradient = ctx.createLinearGradient(0, 70, 0, 76);
    sepGradient.addColorStop(0, '#6a5acd33');
    sepGradient.addColorStop(0.5, '#483d8b33');
    sepGradient.addColorStop(1, '#6a5acd33');
    ctx.fillStyle = sepGradient;
    ctx.fillRect(sidePadding, 70, canvasWidth - sidePadding * 2, 6);

   
    const columns = {
      number: sidePadding + 20,              // №
      code: sidePadding + 170,              // Промокод
      owner: sidePadding + 400,             // Владелец
      uses: canvasWidth - sidePadding - 100 // Использований
    };

  
    ctx.font = 'bold 24px Sans';
    ctx.fillStyle = '#ddd';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('№', columns.number, headerHeight - 20);
     ctx.textAlign = 'center';
    ctx.fillText('Промокод', columns.code, headerHeight - 20);
       ctx.textAlign = 'left';
    ctx.fillText('Владелец', columns.owner, headerHeight - 20);
    ctx.textAlign = 'center';
    ctx.fillText('Использований', columns.uses, headerHeight - 20);


    ctx.font = '22px Sans';
    let y = headerHeight;
    for (let i = 0; i < chunk.length; i++) {
      const [promoName, info] = chunk[i];


      ctx.fillStyle = i % 2 === 0 ? 'rgba(106, 90, 205, 0.1)' : 'rgba(72, 61, 139, 0.1)';
      roundRect(ctx, sidePadding - 10, y + 6, canvasWidth - sidePadding * 2 + 20, rowHeight - 12, 10, true, false);

      ctx.strokeStyle = 'rgba(106, 90, 205, 0.3)';
      ctx.lineWidth = 2;
      roundRect(ctx, sidePadding - 10, y + 6, canvasWidth - sidePadding * 2 + 20, rowHeight - 12, 10, false, true);

      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#eee';

  
      ctx.textAlign = 'left';
      ctx.fillText(`${page * chunkSize + i + 1}`, columns.number, y + rowHeight / 2);

 
      const displayPromo = promoName.length > 20 ? promoName.slice(0, 20) + '…' : promoName;
      ctx.fillText(displayPromo, columns.code, y + rowHeight / 2);


      let ownerName = 'Не найден';
      const ownerMember = message.guild.members.cache.get(info.ownerId);
      if (ownerMember) {
        ownerName = ownerMember.user.username;
        if (ownerName.length > 20) ownerName = ownerName.slice(0, 20) + '…';
      } else {
        ownerName = `ID: ${info.ownerId}`; 
      }
      ctx.fillText(ownerName, columns.owner, y + rowHeight / 2);

   
      ctx.textAlign = 'right';
      ctx.fillText(info.uses.toString(), columns.uses, y + rowHeight / 2);

      y += rowHeight;
    }

  
    ctx.fillStyle = '#888';
    ctx.font = '16px Sans';
    ctx.textAlign = 'left';
    const formattedTime = moment().format('HH:mm');
    ctx.fillText(`Всего промокодов: ${allPromos.length} | Время: ${formattedTime}`, sidePadding, canvasHeight - 15);

    return canvas.toBuffer();
  };

  const buffer = makeEmbed();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('delete_promocodes')
      .setLabel('Удалить')
      .setStyle(ButtonStyle.Danger)
  );

  const sentMsg = await message.channel.send({
    files: [{ attachment: buffer, name: 'promocodes.png' }],
    components: [row],
  });

  const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
  collector.on('collect', async (interaction) => {
    if (interaction.customId === 'delete_promocodes' && interaction.user.id === message.author.id) {
      await sentMsg.delete().catch(() => {});
      collector.stop();
    } else {
      await interaction.reply({ content: 'Вы не можете это сделать.', ephemeral: true });
    }
  });

  collector.on('end', () => {
    if (sentMsg) {
      sentMsg.edit({ components: [] }).catch(() => {});
    }
  });
}
else if (command === 'delpromo') {
  if (!message.member.roles.cache.has(CUR_MOD_ROLE_ID)) {
    const errorEmbed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('❌ Ошибка доступа')
      .setDescription('У вас нет прав для использования этой команды.')
      .setTimestamp()
      .setFooter({ text: 'Доступ запрещён', iconURL: message.author.displayAvatarURL({ dynamic: true }) });

    const errMsg = await message.channel.send({ embeds: [errorEmbed] });
    setTimeout(() => errMsg.delete().catch(() => {}), 5000);
    await message.delete().catch(() => {});
    return;
  }

  const messagesToDelete = [];

  async function askQuestion(question) {
    const filter = m => m.author.id === message.author.id;

    const botMsg = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor('#b19fe3')
        .setDescription(question)
        .setFooter({ text: 'Ответьте в течение 60 секунд' })]
    });

    messagesToDelete.push(botMsg);

    try {
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
      const userMsg = collected.first();
      messagesToDelete.push(userMsg);

      await Promise.all(messagesToDelete.map(m => m.delete().catch(() => {})));
      messagesToDelete.length = 0;

      return userMsg.content.trim();
    } catch {
      const timeoutEmbed = new EmbedBuilder()
        .setColor('#FF5555')
        .setTitle('⏰ Время истекло')
        .setDescription('Удаление промокода отменено.');

      const timeoutMsg = await message.channel.send({ embeds: [timeoutEmbed] });
      setTimeout(() => timeoutMsg.delete().catch(() => {}), 5000);

      throw new Error('timeout');
    }
  }

  try {
    messagesToDelete.push(message);

    let promoName = args[0]?.toLowerCase();
    if (!promoName) {
      promoName = await askQuestion('📝 Введите название промокода для удаления:');
    }

    if (!data.promocodes[promoName]) {
      const notFoundMsg = await message.channel.send('❌ Такой промокод не найден.');
      setTimeout(() => notFoundMsg.delete().catch(() => {}), 5000);
      return;
    }

    const reason = await askQuestion('📝 Укажите причину удаления промокода:');

    const confirmEmbed = new EmbedBuilder()
      .setColor('#FFAA00')
      .setTitle('⚠ Подтвердите удаление')
      .setDescription(`Удалить промокод \`${promoName}\`?\n**Причина:** ${reason}`)
      .setFooter({ text: 'Нажмите ✅ для подтверждения или ❌ для отмены (60 секунд)' });

    const confirmMsg = await message.channel.send({ embeds: [confirmEmbed] });
    await confirmMsg.react('✅');
    await confirmMsg.react('❌');

    const reactionFilter = (reaction, user) =>
      ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id;

    const collectedReaction = await confirmMsg.awaitReactions({
      filter: reactionFilter,
      max: 1,
      time: 60000,
      errors: ['time'],
    });

    const choice = collectedReaction.first().emoji.name;

    await Promise.all([
      confirmMsg.delete().catch(() => {}),
      message.delete().catch(() => {}),
    ]);

    if (choice === '❌') {
      const cancelEmbed = new EmbedBuilder()
        .setColor('#FFAA00')
        .setTitle('❌ Отмена')
        .setDescription('Удаление промокода отменено.');

      const cancelMsg = await message.channel.send({ embeds: [cancelEmbed] });
      setTimeout(() => cancelMsg.delete().catch(() => {}), 5000);
      return;
    }

    const promoInfo = data.promocodes[promoName];
    const ownerId = promoInfo.ownerId;
    let ownerUser = null;

    try {
      ownerUser = await client.users.fetch(ownerId);
    } catch (e) {
      console.warn(`Не удалось получить пользователя ${ownerId}:`, e);
    }

    const deleterTag = message.author.tag;
    delete data.promocodes[promoName];

    for (const uid in data.coinsData) {
      if (data.coinsData[uid].promocode === promoName) data.coinsData[uid].promocode = null;
      if (data.coinsData[uid].usedPromocode === promoName) data.coinsData[uid].usedPromocode = null;
    }

    saveData();

    const resultEmbed = new EmbedBuilder()
      .setTitle('🗑️ Промокод удалён')
      .setColor('#FF5555')
      .setDescription(`**Промокод:** \`${promoName}\`\n` +
        `**Владелец:** ${ownerUser ? ownerUser.tag : 'Пользователь не найден'}\n` +
        `**Причина удаления:** ${reason}\n` +
        `**Удалён модератором:** ${deleterTag}`)
      .setTimestamp();

    await message.channel.send({ embeds: [resultEmbed] });

    if (ownerUser) {
      try {
        await ownerUser.send({
          embeds: [new EmbedBuilder()
            .setTitle('❗ Ваш промокод был удалён')
            .setColor('#FF5555')
            .setDescription(`Промокод \`${promoName}\` был удалён модератором ${deleterTag}.\n` +
              `Причина: ${reason}`)
            .setFooter({ text: 'Если у вас есть вопросы, обратитесь к администрации.' })],
        });
      } catch {

      }
    }

  } catch (e) {
    if (e.message !== 'timeout') {
      console.error('Ошибка удаления промокода:', e);
      const errorEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('❌ Ошибка')
        .setDescription('Произошла ошибка при удалении промокода.');
      const errMsg = await message.channel.send({ embeds: [errorEmbed] });
      setTimeout(() => errMsg.delete().catch(() => {}), 5000);
    }
  }
}
else if (command === 'pay') {
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});

  let rawUser = args[0];
  let amountStr = args[1];

  if (!rawUser) {
    return sendError('❗ Укажите пользователя, которому хотите перевести коины, через упоминание или ID.');
  }

  const userIdMatch = rawUser.match(/^<@!?(\d+)>$/);
  const userId = userIdMatch ? userIdMatch[1] : rawUser;

  const target = await message.client.users.fetch(userId).catch(() => null);

  if (!target) {
    return sendError('❗ Пользователь не найден. Убедитесь, что указали правильный ID или упоминание.');
  }

  if (!amountStr || isNaN(amountStr)) {
    return sendError('❗ Укажите корректное количество коинов для перевода.');
  }

  const amount = parseInt(amountStr, 10);
  if (amount <= 0) {
    return sendError('❗ Количество коинов должно быть больше нуля.');
  }

  const senderId = message.author.id;
  const receiverId = target.id;

  if (senderId === receiverId) {
    return sendError('❗ Нельзя переводить коины самому себе.');
  }

  if (!data.coinsData[senderId]) {
    data.coinsData[senderId] = { coins: 0, promocode: null, usedPromocode: null };
  }
  if (!data.coinsData[receiverId]) {
    data.coinsData[receiverId] = { coins: 0, promocode: null, usedPromocode: null };
  }

  if (data.coinsData[senderId].coins < amount) {
    return sendError(`❌ У вас недостаточно коинов для перевода. Текущий баланс: ${data.coinsData[senderId].coins} коинов.`);
  }

  data.coinsData[senderId].coins -= amount;
  data.coinsData[receiverId].coins += amount;
  saveData();

  const coinWordSender = declOfNum(amount, ['коин', 'коина', 'коинов']);
  const coinWordReceiver = declOfNum(amount, ['коин', 'коина', 'коинов']);

  const reply = 
    `С баланса <@${senderId}> было списано ${amount.toLocaleString('ru-RU')} ${coinWordSender}\n` +
    `На баланс <@${receiverId}> поступило ${amount.toLocaleString('ru-RU')} ${coinWordReceiver}`;

  const sentMessage = await message.channel.send(reply);

  setTimeout(() => {
    sentMessage.delete().catch(() => {});
  }, 30000);

  await message.delete().catch(() => {});
}
if (command === 'create_role') {
  if (!message.member.roles.cache.has(CUR_MOD_ROLE_ID)) {
    return sendError(message, 'У вас нет прав для использования этой команды (требуется роль модератора).');
  }

  await message.delete().catch(() => {});

  async function ask(prompt) {
    const promptMsg = await message.channel.send({
      embeds: [createEmbed({ title: '🛠️ Создание роли', description: prompt, color: '#6A5ACD' })]
    });

    try {
      const collected = await message.channel.awaitMessages({
        filter: m => m.author.id === message.author.id,
        max: 1,
        time: 60000,
        errors: ['time']
      });

      const reply = collected.first();
      await reply.delete().catch(() => {});
      await promptMsg.delete().catch(() => {});
      return reply.content.trim();
    } catch {
      await promptMsg.delete().catch(() => {});
      const timeoutMsg = await message.channel.send({
        embeds: [createEmbed({ title: '⏰ Время вышло', description: 'Создание роли отменено.', color: '#FF5555' })]
      });
      setTimeout(() => timeoutMsg.delete().catch(() => {}), 5000);
      throw new Error('Отмена');
    }
  }

  async function askReaction(prompt, emojis, isEmbed = false) {
    const msg = await message.channel.send({
      embeds: isEmbed
        ? [prompt]
        : [createEmbed({ title: '🛠️ Создание роли', description: prompt, color: '#6A5ACD' })]
    });

    for (const e of emojis) await msg.react(e);

    try {
      const collected = await msg.awaitReactions({
        filter: (r, u) => emojis.includes(r.emoji.name) && u.id === message.author.id,
        max: 1,
        time: 60000,
        errors: ['time']
      });
      const choice = collected.first().emoji.name;
      await msg.delete().catch(() => {});
      return choice;
    } catch {
      await msg.delete().catch(() => {});
      const timeoutMsg = await message.channel.send({
        embeds: [createEmbed({ title: '⏰ Время вышло', description: 'Создание роли отменено.', color: '#FF5555' })]
      });
      setTimeout(() => timeoutMsg.delete().catch(() => {}), 5000);
      throw new Error('Отмена');
    }
  }

  async function askMembers(count) {
    const promptEmbed = createEmbed({
      title: '👥 Ввод участников',
      description:
        count === 1
          ? 'Пожалуйста, упомяните **одного участника** для роли.\n\nПример: `@User`'
          : `Пожалуйста, укажите ровно **${count} участника(ов)** через пробел (ID или упоминания).\n\nПример: \`@User1 @User2\``,
      color: '#6A5ACD',
      footerText: 'Время на ответ: 60 секунд'
    });

    const promptMsg = await message.channel.send({ embeds: [promptEmbed] });

    try {
      const collected = await message.channel.awaitMessages({
        filter: m => m.author.id === message.author.id,
        max: 1,
        time: 60000,
        errors: ['time']
      });

      const reply = collected.first();
      await reply.delete().catch(() => {});
      await promptMsg.delete().catch(() => {});

      return reply.content.trim();
    } catch {
      await promptMsg.delete().catch(() => {});
      const timeoutMsg = await message.channel.send({
        embeds: [createEmbed({ title: '⏰ Время вышло', description: 'Создание роли отменено.', color: '#FF5555' })]
      });
      setTimeout(() => timeoutMsg.delete().catch(() => {}), 5000);
      throw new Error('Отмена');
    }
  }

  try {
    const countChoice = await askReaction(
      'Выберите количество участников для роли:\n\n1️⃣ — Один участник\n2️⃣ — Два участника',
      ['1️⃣', '2️⃣']
    );
    const count = countChoice === '1️⃣' ? 1 : 2;

    const step2 = await askMembers(count);
    const usersRaw = step2.split(/\s+/);
    if (usersRaw.length !== count) {
      return sendError(message, `Нужно ровно ${count} участника(ов).`);
    }

    const memberIds = [];
    for (const u of usersRaw) {
      const match = u.match(/^<@!?(\d+)>$/);
      const userId = match ? match[1] : u;
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) return sendError(message, `Участник "${u}" не найден.`);
      memberIds.push(member.id);
    }

    let payerId = memberIds[0];
    if (count === 2) {
      const payerChoice = await askReaction(
        `Кто будет оплачивать роль?\n\n1️⃣ — <@${memberIds[0]}>\n2️⃣ — <@${memberIds[1]}>`,
        ['1️⃣', '2️⃣']
      );
      payerId = payerChoice === '1️⃣' ? memberIds[0] : memberIds[1];
    }

    const roleName = await ask('Введите название роли (от 1 до 100 символов):');
    if (roleName.length < 1 || roleName.length > 100) return sendError(message, 'Название роли должно быть от 1 до 100 символов.');

    let color = await ask('Введите цвет роли в HEX формате (например #FF0000):');
    if (!/^#?[0-9A-Fa-f]{6}$/.test(color)) return sendError(message, 'Неверный формат цвета.');
    if (!color.startsWith('#')) color = '#' + color;

    const costStr = await ask('Введите стоимость роли в коинах (положительное число):');
    const cost = parseInt(costStr, 10);
    if (isNaN(cost) || cost <= 0) return sendError(message, 'Стоимость должна быть положительным числом.');

    let finalRoleName = roleName;

    const wantEmojis = await askReaction(
      'Хотите добавить смайлы в название роли?\n\n✅ — Да\n❌ — Нет',
      ['✅', '❌']
    );

    let emojis = [];
    if (wantEmojis === '✅') {
      const emojisRaw = await ask('Введите смайлы через пробел:');
      emojis = emojisRaw.split(/\s+/).filter(e => e.length > 0);

      const placement = await askReaction(
        '**🎨 Куда вставить смайлы в названии роли?**\n\n' +
        '🔼 — В начале → `😄 Название`\n' +
        '🔽 — В конце  → `Название 😄`\n' +
        '🔁 — По бокам → `😄 Название 😄`',
        ['🔼', '🔽', '🔁']
      );

      if (placement === '🔼') {
        finalRoleName = `${emojis.join(' ')} ${roleName}`;
      } else if (placement === '🔽') {
        finalRoleName = `${roleName} ${emojis.join(' ')}`;
      } else if (placement === '🔁') {
        finalRoleName = `${emojis.join(' ')} ${roleName} ${emojis.join(' ')}`;
      }
    }

    if (!data.coinsData[payerId]) data.coinsData[payerId] = { coins: 0 };
    if (data.coinsData[payerId].coins < cost) return sendError(message, `<@${payerId}> недостаточно коинов (нужно ${cost}).`);

    const previewEmbed = createEmbed({
      title: '✅ Подтверждение создания роли',
      description:
        `**Название:** ${finalRoleName}\n` +
        `**Цвет:** ${color}\n` +
        `**Стоимость:** ${cost} коинов\n` +
        `**Участники:** ${memberIds.map(id => `<@${id}>`).join(', ')}\n` +
        (count === 2 ? `**Плательщик:** <@${payerId}>\n` : '') +
        `**Смайлы:** ${emojis.length ? emojis.join(' ') : 'Нет'}`,
      color,
      footerText: 'Нажмите ✅ для подтверждения или ❌ для отмены'
    });

    const confirm = await askReaction(previewEmbed, ['✅', '❌'], true);
    if (confirm === '❌') throw new Error('Отмена пользователем');

    const role = await message.guild.roles.create({
      name: finalRoleName,
      color,
      mentionable: true,
      reason: `Создана модератором ${message.author.tag}`
    });

    const referenceRole = message.guild.roles.cache.get(REFERENCE_ROLE_ID);
    if (referenceRole) {
      await role.setPosition(referenceRole.position - 1).catch(console.error);
    }

    for (const id of memberIds) {
      const member = await message.guild.members.fetch(id);
      await member.roles.add(role);
    }

    data.coinsData[payerId].coins -= cost;

    if (!data.privateRoles) data.privateRoles = {};
    data.privateRoles[role.id] = {
      ownerIds: memberIds,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 дней
      warning48Sent: false,
      warning24Sent: false,
      cost,
      color,
      emojis,
      roleName: finalRoleName,
      payerId,
    };
    saveData();

    await message.channel.send({
      embeds: [createEmbed({
        title: '🎉 Роль успешно создана!',
        description:
          `**Название:** ${finalRoleName}\n` +
          `**Участники:** ${memberIds.map(id => `<@${id}>`).join(', ')}\n` +
          `**Цвет:** ${color}\n` +
          `**Стоимость:** ${cost} коинов\n` +
          (count === 2 ? `**Плательщик:** <@${payerId}>\n` : '') +
          `**Смайлы:** ${emojis.length ? emojis.join(' ') : 'Нет'}\n\n` +
          `Роль будет автоматически удалена через **30 дней**.`,
        color,
        footerText: `Создано модератором ${message.author.tag}`
      })]
    });

  } catch (e) {
    if (e.message !== 'Отмена') {
      console.error(e);
      await sendError(message, e.message || 'Произошла ошибка при создании роли.');
    }
  }
}
const ms = 24 * 60 * 60 * 1000;
 if (command === 'del_role') {
  if (!message.member.roles.cache.has(CUR_MOD_ROLE_ID)) {
    const errorEmbed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('❌ Ошибка доступа')
      .setDescription('У вас нет прав для использования этой команды.')
      .setTimestamp()
      .setFooter({ text: 'Доступ запрещён', iconURL: message.author.displayAvatarURL({ dynamic: true }) });

    const errMsg = await message.channel.send({ embeds: [errorEmbed] });
    setTimeout(() => errMsg.delete().catch(() => {}), 5000);
    await message.delete().catch(() => {});
    return;
  }

  const messagesToDelete = [];

  async function askQuestion(question) {
    const filter = m => m.author.id === message.author.id;

    const botMsg = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor('#6A5ACD')
        .setDescription(question)
        .setFooter({ text: 'Ответьте в течение 60 секунд' })]
    });

    messagesToDelete.push(botMsg);

    try {
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
      const userMsg = collected.first();
      messagesToDelete.push(userMsg);

      await Promise.all(messagesToDelete.map(m => m.delete().catch(() => {})));
      messagesToDelete.length = 0;

      return userMsg.content.trim();
    } catch {
      const timeoutEmbed = new EmbedBuilder()
        .setColor('#FF5555')
        .setTitle('⏰ Время истекло')
        .setDescription('Удаление роли отменено.');

      const timeoutMsg = await message.channel.send({ embeds: [timeoutEmbed] });
      setTimeout(() => timeoutMsg.delete().catch(() => {}), 5000);

      throw new Error('timeout');
    }
  }

  try {
    messagesToDelete.push(message);

    // Получаем роль
    let roleRaw = args[0];
    if (!roleRaw) {
      roleRaw = await askQuestion('📝 Упомяните роль для удаления или укажите её ID:');
    }

    const roleIdMatch = roleRaw.match(/^<@&(\d+)>$/) || roleRaw.match(/^(\d+)$/);
    if (!roleIdMatch) {
      const errEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setDescription('❌ Роль не распознана. Укажите упоминание или ID роли.');
      const errMsg = await message.channel.send({ embeds: [errEmbed] });
      setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      return;
    }
    const roleId = roleIdMatch[1];

    const role = message.guild.roles.cache.get(roleId);
    if (!role) {
      const errEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setDescription('❌ Роль не найдена на сервере.');
      const errMsg = await message.channel.send({ embeds: [errEmbed] });
      setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      return;
    }

    if (!data.privateRoles || !data.privateRoles[roleId]) {
      const errEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setDescription('❌ Данная роль не зарегистрирована как приватная.');
      const errMsg = await message.channel.send({ embeds: [errEmbed] });
      setTimeout(() => errMsg.delete().catch(() => {}), 5000);
      return;
    }

    // Запрос причины
    const reason = await askQuestion('📝 Укажите причину удаления роли:');

    // Подтверждение через кнопки
    const confirmEmbed = new EmbedBuilder()
      .setColor('#FFAA00')
      .setTitle('⚠ Подтвердите удаление')
      .setDescription(`Удалить роль <@&${roleId}>?\n**Причина:** ${reason}`);

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_delete')
          .setLabel('Подтвердить')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancel_delete')
          .setLabel(' Отмена')
          .setStyle(ButtonStyle.Danger)
      );

    const confirmMsg = await message.channel.send({ embeds: [confirmEmbed], components: [buttons] });

    const filter = i => ['confirm_delete', 'cancel_delete'].includes(i.customId) && i.user.id === message.author.id;

    const interaction = await confirmMsg.awaitMessageComponent({ filter, time: 60000 }).catch(async () => {
      await confirmMsg.delete().catch(() => {});
      const timeoutEmbed = new EmbedBuilder()
        .setColor('#FF5555')
        .setTitle('⏰ Время истекло')
        .setDescription('Удаление роли отменено.');
      const timeoutMsg = await message.channel.send({ embeds: [timeoutEmbed] });
      setTimeout(() => timeoutMsg.delete().catch(() => {}), 5000);
      throw new Error('timeout');
    });

    await confirmMsg.delete().catch(() => {});
    await message.delete().catch(() => {});

    if (interaction.customId === 'cancel_delete') {
      const cancelEmbed = new EmbedBuilder()
        .setColor('#FFAA00')
        .setTitle('❌ Отмена')
        .setDescription('Удаление роли отменено.');

      const cancelMsg = await message.channel.send({ embeds: [cancelEmbed] });
      setTimeout(() => cancelMsg.delete().catch(() => {}), 5000);
      return;
    }

    // Снимаем роль у всех
    for (const [memberId, member] of role.members) {
      try {
        await member.roles.remove(role);
        // Отправляем ЛС
        try {
          await member.send({
            embeds: [new EmbedBuilder()
              .setColor('#FF5555')
              .setTitle('⚠ Роль удалена')
              .setDescription(`Роль **${role.name}** была удалена модератором ${message.author.tag}.\nПричина: ${reason}`)
              .setFooter({ text: 'Если есть вопросы, обратитесь к администрации.' })]
          });
        } catch {}
      } catch {}
    }

    // Удаляем роль
    await role.delete('Удалена через команду удаления приватной роли');

    // Удаляем из данных
    delete data.privateRoles[roleId];
    saveData();

    const resultEmbed = new EmbedBuilder()
      .setTitle('✅ Роль удалена')
      .setColor('#00FF00')
      .setDescription(`Роль <@&${roleId}> успешно удалена.\nПричина: ${reason}\nУдалил: ${message.author.tag}`);

    await message.channel.send({ embeds: [resultEmbed] });

  } catch (e) {
    if (e.message !== 'timeout') {
      console.error('Ошибка удаления приватной роли:', e);
      const errorEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('❌ Ошибка')
        .setDescription('Произошла ошибка при удалении роли.');
      const errMsg = await message.channel.send({ embeds: [errorEmbed] });
      setTimeout(() => errMsg.delete().catch(() => {}), 5000);
    }
  }
}
setInterval(async () => {
  const now = Date.now();

  if (!data.privateRoles) return;

  for (const [roleId, roleData] of Object.entries(data.privateRoles)) {
    const timeLeft = roleData.expiresAt - now;

    if (timeLeft <= 0) {
      const guildRole = message.guild.roles.cache.get(roleId);
      if (guildRole) {
        try {
          await guildRole.delete('Истекло время действия роли');
        } catch (e) {
          console.error(`Ошибка при удалении роли ${roleId}:`, e);
        }
      }

      const deletedEmbed = createRoleNoticeEmbed(
        '🗑️ Роль удалена',
        `Ваша приватная роль **${roleData.roleName}** была удалена по истечении времени.\n\nСпасибо, что пользовались нашим сервисом!`,
        '#FF4500'
      );

      for (const memberId of roleData.ownerIds) {
        try {
          const member = await message.guild.members.fetch(memberId);
          await member.send({ embeds: [deletedEmbed] });
        } catch {}
      }

      delete data.privateRoles[roleId];
      saveData();

    } else if (timeLeft <= 2 * ms && !roleData.warning48Sent) {
      roleData.warning48Sent = true;

      const warn48Embed = createRoleNoticeEmbed(
        '⚠️ Внимание! Роль будет удалена через 2 дня',
        `Ваша приватная роль **${roleData.roleName}** будет удалена через 2 дня.\n\nПожалуйста, сохраните необходимую информацию или обратитесь к модератору, если хотите продлить роль.`,
        '#FFA500'
      );

      for (const memberId of roleData.ownerIds) {
        try {
          const member = await message.guild.members.fetch(memberId);
          await member.send({ embeds: [warn48Embed] });
        } catch {}
      }

      saveData();

    } else if (timeLeft <= ms && !roleData.warning24Sent) {
      roleData.warning24Sent = true;

      const warn24Embed = createRoleNoticeEmbed(
        '⚠️ Внимание! Роль будет удалена через 1 день',
        `Ваша приватная роль **${roleData.roleName}** будет удалена через 1 день.\n\nПожалуйста, сохраните необходимую информацию или обратитесь к модератору, если хотите продлить роль.`,
        '#FFA500'
      );

      for (const memberId of roleData.ownerIds) {
        try {
          const member = await message.guild.members.fetch(memberId);
          await member.send({ embeds: [warn24Embed] });
        } catch {}
      }

      saveData();
    }
  }
}, 60 * 60 * 1000);
if (command === 'extendrole') {
  try {
    await message.delete().catch(() => {});

    const userId = message.author.id;
    const roleMention = message.mentions.roles.first();

    if (!roleMention) {
      const errorMsg = await message.channel.send({
        embeds: [createEmbed({
          title: '❌ Ошибка',
          description: 'Укажите роль, которую хотите продлить, упомянув её после команды.',
          color: '#E74C3C',
        })],
      });
      setTimeout(() => errorMsg.delete().catch(() => {}), 10000);
      return;
    }

    const roleEntry = Object.entries(data.privateRoles).find(([roleId, roleInfo]) => 
      roleId === roleMention.id && roleInfo.ownerIds.includes(userId)
    );

    if (!roleEntry) {
      const errorMsg = await message.channel.send({
        embeds: [createEmbed({
          title: '❌ Ошибка',
          description: 'У вас нет приватной роли с таким упоминанием или вы не являетесь её владельцем.',
          color: '#E74C3C',
        })],
      });
      setTimeout(() => errorMsg.delete().catch(() => {}), 10000);
      return;
    }

    const [roleId, roleInfo] = roleEntry;


    if (!data.coinsData[userId]) data.coinsData[userId] = { coins: 0 };
    const extendCost = Math.ceil(roleInfo.cost * 0.2);

    if (data.coinsData[userId].coins < extendCost) {
      const errorMsg = await message.channel.send({
        embeds: [createEmbed({
          title: '❌ Ошибка',
          description: `Недостаточно коинов для продления роли (нужно ${extendCost}).`,
          color: '#E74C3C',
        })],
      });
      setTimeout(() => errorMsg.delete().catch(() => {}), 10000);
      return;
    }


    data.coinsData[userId].coins -= extendCost;


    const now = Date.now();
    roleInfo.expiresAt = Math.max(roleInfo.expiresAt, now) + 30 * 24 * 60 * 60 * 1000;
    roleInfo.warningSent = false;
    saveData();

    const successMsg = await message.channel.send({
      embeds: [createEmbed({
        title: '✅ Роль продлена',
        description: `Роль **${roleInfo.roleName}** продлена на 30 дней.\nСтоимость продления: ${extendCost} коинов.`,
        color: roleInfo.color || '#6A5ACD',
      })],
    });
    setTimeout(() => successMsg.delete().catch(() => {}), 10000);

  } catch (error) {
    console.error(error);
    const errorMsg = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Ошибка',
        description: error.message || 'Произошла ошибка.',
        color: '#E74C3C',
      })],
    });
    setTimeout(() => errorMsg.delete().catch(() => {}), 10000);
  }
}
else if (command === 'checkroles') {
  try {
    await message.delete().catch(() => {});

    const userId = message.author.id;
    const now = Date.now();

    const rolesOwned = Object.entries(data.privateRoles)
      .filter(([_, roleInfo]) => roleInfo.ownerIds.includes(userId) && roleInfo.expiresAt > now)
      .sort(([, a], [, b]) => a.expiresAt - b.expiresAt);

    if (rolesOwned.length === 0) {
      const noRolesMsg = await message.channel.send({
        embeds: [createEmbed({
          title: 'ℹ️ Информация',
          description: 'У вас нет активных приватных ролей.',
          color: '#6A5ACD',
        })],
      });
      setTimeout(() => noRolesMsg.delete().catch(() => {}), 30000);
      return;
    }

    const canvasWidth = 1300;
    const rowHeight = 60;
    const headerHeight = 100;
    const tableHeaderHeight = 80;
    const footerHeight = -20;
    const sidePadding = 60;
const canvasHeight = headerHeight + tableHeaderHeight + rolesOwned.length * rowHeight + footerHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#1e2125');
    gradient.addColorStop(1, '#2e3238');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);


    const titleText = '📋 Ваши приватные роли';
    ctx.font = 'bold 42px Sans';
    const textWidth = ctx.measureText(titleText).width;
    const grad = ctx.createLinearGradient(sidePadding, 0, sidePadding + textWidth, 0);
    grad.addColorStop(0, '#e3c55a');
    grad.addColorStop(1, '#c2912a');

    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(255, 200, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.fillText(titleText, sidePadding, 60);
    ctx.shadowColor = 'transparent';


    const sepGradient = ctx.createLinearGradient(0, 70, 0, 76);
    sepGradient.addColorStop(0, '#ffd70033');
    sepGradient.addColorStop(0.5, '#ffaa0033');
    sepGradient.addColorStop(1, '#ffd70033');

    ctx.fillStyle = sepGradient;
    ctx.fillRect(sidePadding, 70, canvasWidth - sidePadding * 2, 6);


    const columns = [
      { title: '№', x: sidePadding + 20, align: 'left' },
      { title: 'Название роли', x: sidePadding + 100, align: 'left' },
      { title: 'Истекает', x: sidePadding + 820, align: 'right' },
      { title: 'Осталось', x: sidePadding + 1100, align: 'right' }
    ];

    ctx.font = 'bold 26px Sans';
    ctx.fillStyle = '#929090ff';
    for (const col of columns) {
      ctx.textAlign = col.align;
      ctx.fillText(col.title, col.x, headerHeight + 10);
    }


    let y = headerHeight + tableHeaderHeight - rowHeight / 2;
    ctx.font = '22px Sans';

    for (let i = 0; i < rolesOwned.length; i++) {
      const [_, roleInfo] = rolesOwned[i];
      const expiresAt = roleInfo.expiresAt;
      const remainingMs = expiresAt - now;

  
      let hexColor = roleInfo.color || '#6A5ACD';
      if (!hexColor || hexColor === '#000000') hexColor = '#6A5ACD';


      ctx.fillStyle = hexToRgba(hexColor, 0.1);
      roundRect(ctx, sidePadding - 10, y - rowHeight / 2 + 5, canvasWidth - sidePadding * 2 + 20, rowHeight - 10, 10, true, false);

  
      ctx.strokeStyle = hexToRgba(hexColor, 0.2);
      ctx.lineWidth = 2;
      roundRect(ctx, sidePadding - 10, y - rowHeight / 2 + 5, canvasWidth - sidePadding * 2 + 20, rowHeight - 10, 10, false, true);

      ctx.fillStyle = '#a5a4a4ff';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}`, sidePadding + 20, y);

      ctx.fillText(roleInfo.roleName.length > 40 ? roleInfo.roleName.slice(0, 40) + '…' : roleInfo.roleName, sidePadding + 100, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#b6b5b5ff';
      ctx.fillText(moment(expiresAt).format('DD.MM.YYYY'), sidePadding + 820, y);

      const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
      ctx.fillText(`${remainingDays} дн.`, sidePadding + 1100, y);

      y += rowHeight; 
    }

  
    ctx.fillStyle = '#888';
    ctx.font = '16px Sans';
    ctx.textAlign = 'left';
    const formattedTime = moment().format('DD.MM.YYYY • HH:mm');
    ctx.fillText(`Всего ролей: ${rolesOwned.length} • Сформировано: ${formattedTime}`, sidePadding, canvasHeight - 15);

    const buffer = canvas.toBuffer();

    const sentMsg = await message.channel.send({
      files: [{ attachment: buffer, name: 'roles.png' }]
    });

    setTimeout(() => {
      sentMsg.delete().catch(() => {});
    }, 30000);

  } catch (error) {
    console.error(error);
    const errorMsg = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Ошибка',
        description: error.message || 'Произошла ошибка.',
        color: '#E74C3C',
      })],
    });
    setTimeout(() => errorMsg.delete().catch(() => {}), 30000);
  }
}
function hexToRgba(hex, alpha = 1) {
  hex = hex.replace('#', '');
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  } else {
    for (let side of ['tl', 'tr', 'br', 'bl']) {
      radius[side] = radius[side] || 0;
    }
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
if (command === 'give_coins') {

  if (!message.member.roles.cache.has(MAIN_MOD_ROLE_ID)) {
    const errorEmbed = {
      color: 0xE74C3C, 
      title: '❌ Ошибка доступа',
      description: 'У вас нет прав для использования этой команды.',
      timestamp: new Date(),
      footer: {
        text: 'Доступ запрещён',
        icon_url: message.author.displayAvatarURL({ dynamic: true }),
      },
    };

    const botMsg = await message.channel.send({ embeds: [errorEmbed] });
    setTimeout(() => botMsg.delete().catch(() => {}), 5000);
    await message.delete().catch(() => {});
    return;
  }

  const userMention = args[0];
  const amount = parseInt(args[1], 10);
  const reason = args.slice(2).join(' ') || 'Не указана';

  if (!userMention || isNaN(amount) || amount <= 0) {
    const usageEmbed = {
      color: 0xE67E22, 
      title: '❗ Неверное использование команды',
      description: 'Использование:\n`/give_coins @пользователь количество причина`',
      timestamp: new Date(),
      footer: {
        text: 'Попробуйте снова',
        icon_url: message.author.displayAvatarURL({ dynamic: true }),
      },
    };

    const botMsg = await message.channel.send({ embeds: [usageEmbed] });
    setTimeout(() => botMsg.delete().catch(() => {}), 5000);
    await message.delete().catch(() => {});
    return;
  }

  const userIdMatch = userMention.match(/^<@!?(\d+)>$/);
  if (!userIdMatch) {
    const invalidUserEmbed = {
      color: 0xE74C3C,
      title: '❌ Некорректный пользователь',
      description: 'Пожалуйста, укажите пользователя через упоминание (@пользователь).',
      timestamp: new Date(),
      footer: {
        text: 'Ошибка ввода',
        icon_url: message.author.displayAvatarURL({ dynamic: true }),
      },
    };

    const botMsg = await message.channel.send({ embeds: [invalidUserEmbed] });
    setTimeout(() => botMsg.delete().catch(() => {}), 5000);
    await message.delete().catch(() => {});
    return;
  }

  const targetUserId = userIdMatch[1];

  if (!data.coinsData[targetUserId]) {
    data.coinsData[targetUserId] = { coins: 0, promocode: null, usedPromocode: null };
  }

  data.coinsData[targetUserId].coins += amount;
  saveData();

  const successEmbed = {
    color: 0x9B59B6,
    title: '✨ Выдача коинов',
    description: `Модератор <@${message.author.id}> выдал коины участнику.`,
    fields: [
      {
        name: '👤 Получатель',
        value: `<@${targetUserId}>`,
        inline: true,
      },
      {
        name: '💰 Количество',
        value: `**${amount.toLocaleString('ru-RU')}** коинов`,
        inline: true,
      },
      {
        name: '📝 Причина',
        value: reason,
        inline: false,
      },
    ],
    timestamp: new Date(),
    footer: {
      text: 'Выдача коинов',
      icon_url: message.author.displayAvatarURL({ dynamic: true }),
    },
  };

  await message.channel.send({ embeds: [successEmbed] });

  await message.delete().catch(() => {});
}
else if (command === 'take_coins') {

  if (!message.member.roles.cache.has(MAIN_MOD_ROLE_ID)) {
    const errorEmbed = {
      color: 0xE74C3C,
      title: '❌ Ошибка доступа',
      description: 'У вас нет прав для использования этой команды.',
      timestamp: new Date(),
      footer: {
        text: 'Доступ запрещён',
        icon_url: message.author.displayAvatarURL({ dynamic: true }),
      },
    };

    const botMsg = await message.channel.send({ embeds: [errorEmbed] });
    setTimeout(() => botMsg.delete().catch(() => {}), 5000);
    await message.delete().catch(() => {});
    return;
  }

  const userMention = args[0];
  const amount = parseInt(args[1], 10);
  const reason = args.slice(2).join(' ') || 'Не указана';

  if (!userMention || isNaN(amount) || amount <= 0) {
    const usageEmbed = {
      color: 0xE67E22,
      title: '❗ Неверное использование команды',
      description: 'Использование:\n`/take_coins @пользователь количество причина`',
      timestamp: new Date(),
      footer: {
        text: 'Попробуйте снова',
        icon_url: message.author.displayAvatarURL({ dynamic: true }),
      },
    };

    const botMsg = await message.channel.send({ embeds: [usageEmbed] });
    setTimeout(() => botMsg.delete().catch(() => {}), 5000);
    await message.delete().catch(() => {});
    return;
  }

  const userIdMatch = userMention.match(/^<@!?(\d+)>$/);
  if (!userIdMatch) {
    const invalidUserEmbed = {
      color: 0xE74C3C,
      title: '❌ Некорректный пользователь',
      description: 'Пожалуйста, укажите пользователя через упоминание (@пользователь).',
      timestamp: new Date(),
      footer: {
        text: 'Ошибка ввода',
        icon_url: message.author.displayAvatarURL({ dynamic: true }),
      },
    };

    const botMsg = await message.channel.send({ embeds: [invalidUserEmbed] });
    setTimeout(() => botMsg.delete().catch(() => {}), 5000);
    await message.delete().catch(() => {});
    return;
  }

  const targetUserId = userIdMatch[1];

  if (!data.coinsData[targetUserId]) {
    data.coinsData[targetUserId] = { coins: 0, promocode: null, usedPromocode: null };
  }

  data.coinsData[targetUserId].coins = Math.max(0, data.coinsData[targetUserId].coins - amount);
  saveData();

  const successEmbed = {
    color: 0x3498DB,
    title: '💸 Снятие коинов',
    description: `Модератор <@${message.author.id}> снял коины у участника.`,
    fields: [
      {
        name: '👤 Участник',
        value: `<@${targetUserId}>`,
        inline: true,
      },
      {
        name: '💰 Количество',
        value: `**${amount.toLocaleString('ru-RU')}** коинов`,
        inline: true,
      },
      {
        name: '📝 Причина',
        value: reason,
        inline: false,
      },
    ],
    timestamp: new Date(),
    footer: {
      text: 'Снятие коинов',
      icon_url: message.author.displayAvatarURL({ dynamic: true }),
    },
  };

  await message.channel.send({ embeds: [successEmbed] });
  await message.delete().catch(() => {});
}
else if (command === 'give_bonus_role') {
  if (!message.member.roles.cache.has(MAIN_MOD_ROLE_ID)) {
    const noAccess = await message.reply({
      embeds: [{
        color: 0xE74C3C,
        title: '❌ Ошибка доступа',
        description: '🚫 У вас нет прав для использования этой команды.',
        timestamp: new Date(),
        footer: {
          text: 'Система бонусов',
          icon_url: message.guild.iconURL({ dynamic: true })
        }
      }]
    });
    setTimeout(() => noAccess.delete().catch(() => {}), 10000);
    message.delete().catch(() => {});
    return;
  }

  const roleMention = args[0];
  const amount = parseInt(args[1], 10);

  if (!roleMention || isNaN(amount) || amount <= 0) {
    const invalidUsage = await message.reply({
      embeds: [{
        color: 0xE67E22,
        title: '⚠️ Неверное использование',
        description: '❗ Использование: /give_bonus_role @роль количество',
        timestamp: new Date(),
        footer: {
          text: 'Система бонусов',
          icon_url: message.guild.iconURL({ dynamic: true })
        }
      }]
    });
    setTimeout(() => invalidUsage.delete().catch(() => {}), 10000);
    message.delete().catch(() => {});
    return;
  }

  const roleIdMatch = roleMention.match(/^<@&(\d+)>$/);
  if (!roleIdMatch) {
    const invalidMention = await message.reply({
      embeds: [{
        color: 0xE67E22,
        title: '⚠️ Ошибка',
        description: '❗ Укажите роль упоминанием.',
        timestamp: new Date(),
        footer: {
          text: 'Система бонусов',
          icon_url: message.guild.iconURL({ dynamic: true })
        }
      }]
    });
    setTimeout(() => invalidMention.delete().catch(() => {}), 10000);
    message.delete().catch(() => {});
    return;
  }

  const targetRoleId = roleIdMatch[1];
  const role = message.guild.roles.cache.get(targetRoleId);
  if (!role) {
    const roleNotFound = await message.reply({
      embeds: [{
        color: 0xE74C3C,
        title: '❌ Роль не найдена',
        description: '❗ Роль не найдена на сервере.',
        timestamp: new Date(),
        footer: {
          text: 'Система бонусов',
          icon_url: message.guild.iconURL({ dynamic: true })
        }
      }]
    });
    setTimeout(() => roleNotFound.delete().catch(() => {}), 10000);
    message.delete().catch(() => {});
    return;
  }


  if (!global.activeBonusRoles) global.activeBonusRoles = {};

  
  if (global.activeBonusRoles[targetRoleId]) {
    clearInterval(global.activeBonusRoles[targetRoleId].intervalId);
  }


  const intervalId = setInterval(() => {
    const bonusRole = message.guild.roles.cache.get(targetRoleId);
    if (!bonusRole) {
      clearInterval(intervalId);
      delete global.activeBonusRoles[targetRoleId];
      saveBonusRoles(global.activeBonusRoles);
      return;
    }

 
    if (!data.coinsData) data.coinsData = {};

    bonusRole.members.forEach(member => {
      if (!data.coinsData[member.id]) {
        data.coinsData[member.id] = {
          coins: 0,
          promocode: null,
          usedPromocode: null,
          deposit: 0,
          depositIncome: 0,
          status: "🌱 Начинающий"
        };
      }

      data.coinsData[member.id].coins += amount;
    });

    saveData();
  }, 3600000); // 1 час

  global.activeBonusRoles[targetRoleId] = { amount, intervalId };
  saveBonusRoles(global.activeBonusRoles);

  const successEmbed = {
    color: 0x3498DB,
    title: '✨ Начисление бонусов активировано',
    description: `🚀 Автоматическое начисление коинов для роли <@&${targetRoleId}> успешно запущено.`,
    fields: [
      { name: '🎭 Роль', value: `<@&${targetRoleId}>`, inline: true },
      { name: '💰 Бонус', value: `**${amount.toLocaleString('ru-RU')}** коинов`, inline: true },
      { name: '⏱️ Интервал', value: 'Каждый час', inline: true }
    ],
    footer: {
      text: 'Система бонусов',
      icon_url: message.guild.iconURL({ dynamic: true })
    },
    timestamp: new Date()
  };

  await message.channel.send({ embeds: [successEmbed] });
  message.delete().catch(() => {});
}
else if (command === 'remove_bonus_role') {
  if (!message.member.roles.cache.has(MAIN_MOD_ROLE_ID)) {
    const errorEmbed = {
      color: 0xE74C3C,
      title: '❌ Ошибка доступа',
      description: 'У вас нет прав для использования этой команды.',
      timestamp: new Date(),
      footer: {
        text: 'Доступ запрещён',
        icon_url: message.author.displayAvatarURL({ dynamic: true }),
      },
    };
    const errorMsg = await message.channel.send({ embeds: [errorEmbed] });
    setTimeout(() => errorMsg.delete().catch(() => {}), 30000);
    await message.delete().catch(() => {});
    return;
  }

  const roleMention = args[0];
  if (!roleMention) {
    const usageEmbed = {
      color: 0xE67E22,
      title: '⚠️ Неверное использование',
      description: 'Укажите роль упоминанием для удаления бонуса.\nПример: `/remove_bonus_role @Роль`',
      timestamp: new Date(),
      footer: {
        text: 'Система бонусов',
        icon_url: message.guild.iconURL({ dynamic: true }),
      },
    };
    const usageMsg = await message.channel.send({ embeds: [usageEmbed] });
    setTimeout(() => usageMsg.delete().catch(() => {}), 30000);
    await message.delete().catch(() => {});
    return;
  }

  const roleIdMatch = roleMention.match(/^<@&(\d+)>$/);
  if (!roleIdMatch) {
    const invalidEmbed = {
      color: 0xE67E22,
      title: '⚠️ Некорректное упоминание роли',
      description: 'Пожалуйста, укажите роль корректно, используя упоминание (например, `@Роль`).',
      timestamp: new Date(),
      footer: {
        text: 'Система бонусов',
        icon_url: message.guild.iconURL({ dynamic: true }),
      },
    };
    const invalidMsg = await message.channel.send({ embeds: [invalidEmbed] });
    setTimeout(() => invalidMsg.delete().catch(() => {}), 30000);
    await message.delete().catch(() => {});
    return;
  }

  const targetRoleId = roleIdMatch[1];
  const role = message.guild.roles.cache.get(targetRoleId);
  if (!role) {
    const notFoundEmbed = {
      color: 0xE74C3C,
      title: '❌ Роль не найдена',
      description: 'Указанная роль не найдена на сервере.',
      timestamp: new Date(),
      footer: {
        text: 'Система бонусов',
        icon_url: message.guild.iconURL({ dynamic: true }),
      },
    };
    const notFoundMsg = await message.channel.send({ embeds: [notFoundEmbed] });
    setTimeout(() => notFoundMsg.delete().catch(() => {}), 30000);
    await message.delete().catch(() => {});
    return;
  }

  if (!global.activeBonusRoles[targetRoleId]) {
    const noBonusEmbed = {
      color: 0xF1C40F,
      title: '⚠️ Бонус для роли не активен',
      description: `Для роли ${role} не запущено автоначисление бонусов.`,
      timestamp: new Date(),
      footer: {
        text: 'Система бонусов',
        icon_url: message.guild.iconURL({ dynamic: true }),
      },
    };
    const noBonusMsg = await message.channel.send({ embeds: [noBonusEmbed] });
    setTimeout(() => noBonusMsg.delete().catch(() => {}), 30000);
    await message.delete().catch(() => {});
    return;
  }


  clearInterval(global.activeBonusRoles[targetRoleId].intervalId);

  delete global.activeBonusRoles[targetRoleId];

  saveBonusRoles(global.activeBonusRoles);

  const successEmbed = {
    color: 0x2ECC71,
    title: '✅ Автоначисление бонусов остановлено',
    description: `Автоначисление бонусов для роли ${role} успешно удалено.`,
    timestamp: new Date(),
    footer: {
      text: 'Система бонусов',
      icon_url: message.guild.iconURL({ dynamic: true }),
    },
  };

  const successMsg = await message.channel.send({ embeds: [successEmbed] });
  setTimeout(() => successMsg.delete().catch(() => {}), 30000);
  await message.delete().catch(() => {});
}
else if (command === 'list_bonus_roles') {
  if (!message.member.roles.cache.has(MAIN_MOD_ROLE_ID)) {
    const errorEmbed = {
      color: 0xE74C3C,
      title: '🚫 Доступ запрещён',
      description: 'У вас нет прав для использования этой команды.',
      footer: {
        text: 'Система бонусов',
        icon_url: message.author.displayAvatarURL({ dynamic: true }),
      },
      timestamp: new Date(),
    };
    const botMsg = await message.channel.send({ embeds: [errorEmbed] });
    setTimeout(() => botMsg.delete().catch(() => {}), 5000);
    await message.delete().catch(() => {});
    return;
  }

  let bonusRolesData;
  try {
    bonusRolesData = JSON.parse(fs.readFileSync('./bonusRoles.json', 'utf-8'));
  } catch (err) {
    console.error('Ошибка чтения bonusRoles.json:', err);
    return message.reply('Ошибка при загрузке бонусных ролей.');
  }

  if (!bonusRolesData || Object.keys(bonusRolesData).length === 0) {
    const noRolesEmbed = {
      color: 0xF39C12,
      title: '📭 Нет активных бонусных ролей',
      description: 'В данный момент **не запущено** ни одного автоначисления бонусов.',
      footer: {
        text: 'Система бонусов',
        icon_url: message.client.user.displayAvatarURL(),
      },
      timestamp: new Date(),
    };
    await message.channel.send({ embeds: [noRolesEmbed] });
    await message.delete().catch(() => {});
    return;
  }

  const formattedBonusRoles = Object.entries(bonusRolesData).map(([roleId, info]) => {
    const role = message.guild.roles.cache.get(roleId);
    return role
      ? {
          name: role.name,
          members: role.members.size,
          amount: info.amount,
          color: role.hexColor || '#6A5ACD',
        }
      : null;
  }).filter(Boolean);

  function hexToRgba(hex, alpha = 1) {
    hex = hex.replace('#', '');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof radius === 'number') {
      radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
      for (let side of ['tl', 'tr', 'br', 'bl']) {
        radius[side] = radius[side] || 0;
      }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  const canvasWidth = 1100;
  const rowHeight = 80;
  const headerHeight = 120;
  const footerHeight = 50;
  const sidePadding = 50;
  const canvasHeight = headerHeight + formattedBonusRoles.length * rowHeight + footerHeight;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, '#1e2125');
  gradient.addColorStop(1, '#2e3238');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);


  const titleText = '📋 Активные бонусные роли';
  ctx.font = 'bold 36px Sans';
  const titleWidth = ctx.measureText(titleText).width;
  const grad = ctx.createLinearGradient(sidePadding, 0, sidePadding + titleWidth, 0);
  grad.addColorStop(0, '#e3c55a');
  grad.addColorStop(1, '#c2912a');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(255, 200, 0, 0.4)';
  ctx.shadowBlur = 10;
  ctx.fillText(titleText, sidePadding, 50);
  ctx.shadowColor = 'transparent';


  const sepGradient = ctx.createLinearGradient(0, 70, 0, 76);
  sepGradient.addColorStop(0, '#ffd70033');
  sepGradient.addColorStop(0.5, '#ffaa0033');
  sepGradient.addColorStop(1, '#ffd70033');
  ctx.fillStyle = sepGradient;
  ctx.fillRect(sidePadding, 70, canvasWidth - sidePadding * 2, 6);


  const columns = [
    { title: '№', x: sidePadding + 20, align: 'left' },
    { title: 'Роль', x: sidePadding + 100, align: 'left' },
    { title: 'Участников', x: canvasWidth - sidePadding - 250, align: 'right' },
    { title: 'Бонус', x: canvasWidth - sidePadding - 50, align: 'right' },
  ];

  ctx.font = 'bold 24px Sans';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  for (const col of columns) {
    ctx.textAlign = col.align;
    ctx.fillText(col.title, col.x, headerHeight - 20);
  }


  ctx.font = '22px Sans';
  let y = headerHeight;
  for (let i = 0; i < formattedBonusRoles.length; i++) {
    const roleInfo = formattedBonusRoles[i];
    ctx.fillStyle = hexToRgba(roleInfo.color, 0.1);
    roundRect(ctx, sidePadding - 10, y + 6, canvasWidth - sidePadding * 2 + 20, rowHeight - 12, 10, true, false);

    ctx.strokeStyle = hexToRgba(roleInfo.color, 0.3);
    ctx.lineWidth = 2;
    roundRect(ctx, sidePadding - 10, y + 6, canvasWidth - sidePadding * 2 + 20, rowHeight - 12, 10, false, true);

    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#eee';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}`, sidePadding + 20, y + rowHeight / 2);

    ctx.fillText(roleInfo.name.length > 30 ? roleInfo.name.slice(0, 30) + '…' : roleInfo.name, sidePadding + 100, y + rowHeight / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#eee';
    ctx.fillText(roleInfo.members.toString(), canvasWidth - sidePadding - 250, y + rowHeight / 2);

    ctx.fillStyle = '#ffffff'; // Bonus column white color
    ctx.fillText('+' + roleInfo.amount.toLocaleString('ru-RU'), canvasWidth - sidePadding - 50, y + rowHeight / 2);

    y += rowHeight;
  }

  ctx.fillStyle = '#888';
  ctx.font = '16px Sans';
  ctx.textAlign = 'left';
  const formattedTime = moment().format('HH:mm');
  ctx.fillText(`Всего ролей: ${formattedBonusRoles.length} | Время запроса: ${formattedTime}`, sidePadding, canvasHeight - 15);

  const buffer = canvas.toBuffer();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('delete_bonus_roles')
      .setLabel('Удалить')
      .setStyle(ButtonStyle.Danger)
  );

  const sentMsg = await message.channel.send({
    files: [{ attachment: buffer, name: 'bonus_roles.png' }],
    components: [row],
  });

  const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
  collector.on('collect', async i => {
    if (i.customId === 'delete_bonus_roles' && i.user.id === message.author.id) {
      await sentMsg.delete().catch(() => {});
      collector.stop();
    } else {
      await i.reply({ content: 'Вы не можете это сделать.', ephemeral: true });
    }
  });

  collector.on('end', () => {
    if (sentMsg) {
      sentMsg.edit({ components: [] }).catch(() => {});
    }
  });

  await message.delete().catch(() => {});
}
if (command === 'togglecoins') {
  const formattedTime = new Date().toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (!message.member.roles.cache.has(MAIN_MOD_ROLE_ID)) {
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setDescription('🚫 У вас нет прав на выполнение этой команды.')
      .setFooter({ text: `Система коинов • Сегодня, в ${formattedTime}` });

    return message.channel.send({ embeds: [embed] })
      .then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
  }

  message.delete().catch(() => {});

  if (args.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('Orange')
      .setTitle('⚠️ Неверное использование.')
      .setDescription('❗ Использование: `/togglecoins #канал`')
      .setFooter({ text: `Система коинов • Сегодня, в ${formattedTime}` });

    return message.channel.send({ embeds: [embed] })
      .then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
  }

  const targetChannel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);

  if (!targetChannel) {
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Канал не найден')
      .setDescription('⚠️ Неверное использование.\n❗ Использование: `/togglecoins #канал`'
      )
      .setFooter({ text: `Система коинов • Сегодня, в ${formattedTime}` });

    return message.channel.send({ embeds: [embed] })
      .then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
  }

  const channelId = targetChannel.id;
  const index = data.disabledChannels.indexOf(channelId);

  if (index !== -1) {
    data.disabledChannels.splice(index, 1);
    saveData();

    const embed = new EmbedBuilder()
      .setColor('Green')
      .setTitle('✅ Коин-система активирована')
      .setDescription(`Начисление коинов **включено** в канале ${targetChannel}.`)
      .setFooter({ text: `Система коинов • Сегодня, в ${formattedTime}` });

    return message.channel.send({ embeds: [embed] })
      .then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
  } else {
    data.disabledChannels.push(channelId);
    saveData();

    const embed = new EmbedBuilder()
      .setColor('Yellow')
      .setTitle('⛔ Коин-система отключена')
      .setDescription(`Начисление коинов **отключено** в канале ${targetChannel}.`)
      .setFooter({ text: `Система коинов • Сегодня, в ${formattedTime}` });

    return message.channel.send({ embeds: [embed] })
      .then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
  }
}
else if (command === 'listdisabledchannels') {
  if (!message.member.roles.cache.has(MAIN_MOD_ROLE_ID)) {
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Нет доступа')
      .setDescription('У вас нет прав для использования этой команды.')
      .setColor('Red');
    return message.channel.send({ embeds: [errorEmbed] });
  }

  if (!data.disabledChannels || data.disabledChannels.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('✅ Все каналы активны')
      .setDescription('Коины начисляются во **всех каналах** сервера.')
      .setColor('Green')
      .setTimestamp();
    await message.channel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
    return;
  }


  const channelsList = data.disabledChannels.map(id => {
    const channel = message.guild.channels.cache.get(id);
    return {
      id,
      name: channel?.name || '❓ Не найден',
      missing: !channel
    };
  });

  channelsList.sort((a, b) => {
    if (a.missing && !b.missing) return 1;
    if (!a.missing && b.missing) return -1;
    return a.name.localeCompare(b.name);
  });


  const canvasWidth = 1100;
  const rowHeight = 60;
  const headerHeight = 120;
  const footerHeight = 50;
  const sidePadding = 50;
  const canvasHeight = headerHeight + channelsList.length * rowHeight + footerHeight;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');


  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, '#1e2125');
  gradient.addColorStop(1, '#2e3238');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);


  const titleText = '📛 Каналы с отключёнными коинами';
  ctx.font = 'bold 36px Sans';
  const titleWidth = ctx.measureText(titleText).width;
  const grad = ctx.createLinearGradient(sidePadding, 0, sidePadding + titleWidth, 0);
  grad.addColorStop(0, '#e35c5a');
  grad.addColorStop(1, '#c22a2a');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(255, 50, 50, 0.5)';
  ctx.shadowBlur = 10;
  ctx.fillText(titleText, sidePadding, 50);
  ctx.shadowColor = 'transparent';


  const sepGradient = ctx.createLinearGradient(0, 70, 0, 76);
  sepGradient.addColorStop(0, '#ff5a5a33');
  sepGradient.addColorStop(0.5, '#cc2a2a33');
  sepGradient.addColorStop(1, '#ff5a5a33');
  ctx.fillStyle = sepGradient;
  ctx.fillRect(sidePadding, 70, canvasWidth - sidePadding * 2, 6);


  const columns = [
    { title: '№', x: sidePadding + 20, align: 'left' },
    { title: 'ID канала', x: sidePadding + 80, align: 'left' },
    { title: 'Название', x: canvasWidth - sidePadding - 350, align: 'left' },
  ];

  ctx.font = 'bold 24px Sans';
  ctx.fillStyle = '#ddd';
  ctx.textBaseline = 'middle';

  for (const col of columns) {
    ctx.textAlign = col.align;
    ctx.fillText(col.title, col.x, headerHeight - 20);
  }


  ctx.font = '22px Sans';
  let y = headerHeight;
  for (let i = 0; i < channelsList.length; i++) {
    const ch = channelsList[i];


    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 90, 90, 0.1)' : 'rgba(200, 40, 40, 0.1)';
    ctx.fillRect(sidePadding - 10, y + 6, canvasWidth - sidePadding * 2 + 20, rowHeight - 12);


    ctx.strokeStyle = 'rgba(255, 90, 90, 0.3)';
    ctx.lineWidth = 2;
    roundRect(ctx, sidePadding - 10, y + 6, canvasWidth - sidePadding * 2 + 20, rowHeight - 12, 10, false, true);

    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#eee';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}`, sidePadding + 20, y + rowHeight / 2);

    ctx.fillText(ch.id, sidePadding + 80, y + rowHeight / 2);

    ctx.fillText(ch.name.length > 35 ? ch.name.slice(0, 35) + '…' : ch.name, canvasWidth - sidePadding - 350, y + rowHeight / 2);

    y += rowHeight;
  }


  ctx.fillStyle = '#888';
  ctx.font = '16px Sans';
  ctx.textAlign = 'left';
  const formattedTime = moment().format('HH:mm');
  ctx.fillText(`Всего отключено: ${channelsList.length} | Время запроса: ${formattedTime}`, sidePadding, canvasHeight - 15);


  const buffer = canvas.toBuffer();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('delete_disabled_channels_list')
      .setLabel('Удалить')
      .setStyle(ButtonStyle.Danger)
  );

  const sentMsg = await message.channel.send({
    files: [{ attachment: buffer, name: 'disabled_channels.png' }],
    components: [row],
  });


  const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
  collector.on('collect', async i => {
    if (i.customId === 'delete_disabled_channels_list' && i.user.id === message.author.id) {
      await sentMsg.delete().catch(() => {});
      collector.stop();
    } else {
      await i.reply({ content: 'Вы не можете это сделать.', ephemeral: true });
    }
  });

  collector.on('end', () => {
    if (sentMsg) {
      sentMsg.edit({ components: [] }).catch(() => {});
    }
  });

  await message.delete().catch(() => {});
}
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  } else {
    for (let side of ['tl', 'tr', 'br', 'bl']) {
      radius[side] = radius[side] || 0;
    }
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
if (command === 'startlottery') {
  if (message.channel.id !== COINS_CHANNEL_ID) {
    message.delete().catch(() => {});
    return;
  }

  if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
    message.reply('У тебя нет прав для запуска лотереи.').then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 10000);
    });
    message.delete().catch(() => {});
    return;
  }

  if (lotteryMessage) {
    message.reply('❗ Лотерея уже запущена!').then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 10000);
    });
    message.delete().catch(() => {});
    return;
  }

  let lotteryWinCount = 0;

  const createBaseEmbed = () => {
    return new EmbedBuilder()
      .setTitle('🎟️ Добро пожаловать в Лотерею Солнечного Города! 🎟️')
      .setColor('#FFD700')
      .setDescription(
  `🌟 Это уникальный шанс испытать свою удачу и стать обладателем огромного приза! Каждый желающий может принять участие — всё, что нужно, это потратить всего лишь ${LOTTERY_ENTRY_COST} коинов.\n\n` +
  `🎉 Лотерея стартует с начальным призом в ${INITIAL_PRIZE} коинов, и с каждым участником этот фонд только увеличивается.\n\n` +
  `🔔 Лотерея работает непрерывно — каждые **24 часа** мы выбираем счастливчика, который уносит весь накопленный приз! Это значит, что с каждым новым участником приз растёт всё больше и больше.\n\n` +
  `🎟️ Для участия просто нажмите на реакцию 🎟️ под этим сообщением. После этого с вашего баланса спишется стоимость входа, и вы попадёте в список участников.\n\n` +
  `⚠️ Участвовать можно сколько угодно раз — каждая ставка увеличивает шанс на выигрыш!\n\n` +
  `🔥 Испытайте судьбу прямо сейчас и станьте следующим легендарным победителем! 🍀\n\n` +
  `👥 **Участников сейчас: 0**\n` +
  `🏆 **Текущий призовой фонд: ${INITIAL_PRIZE} коинов**`
      )
      .setFooter({ text: 'Лотерея работает 24/7. Удачи всем участникам!' })
      .setTimestamp();
  };

  lotteryMessage = await message.channel.send({ embeds: [createBaseEmbed()] });
  await lotteryMessage.react('🎟️');
  lotteryParticipants.clear();
  message.delete().catch(() => {});

  const filter = (reaction, user) => reaction.emoji.name === '🎟️' && !user.bot;
  const collector = lotteryMessage.createReactionCollector({ filter });

  collector.on('collect', async (reaction, user) => {
    if (lotteryParticipants.has(user.id)) {
      try { await reaction.users.remove(user.id); } catch {}
      return;
    }

    if (!data.coinsData[user.id]) {
      data.coinsData[user.id] = { coins: 0, promocode: null, usedPromocode: null };
    }

    if (data.coinsData[user.id].coins < LOTTERY_ENTRY_COST) {
      try {
        await reaction.users.remove(user.id);
        const coinsChannel = await client.channels.fetch(COINS_CHANNEL_ID);
        coinsChannel.send(`<@${user.id}>, у тебя недостаточно коинов для участия в лотерее (${LOTTERY_ENTRY_COST}).`)
          .then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
      } catch {}
      return;
    }

    data.coinsData[user.id].coins -= LOTTERY_ENTRY_COST;
    saveData();
    lotteryParticipants.add(user.id);

    const currentPrize = INITIAL_PRIZE + lotteryParticipants.size * LOTTERY_ENTRY_COST;
    const oldEmbed = lotteryMessage.embeds[0];
    const embed = EmbedBuilder.from(oldEmbed);
    const lines = oldEmbed.description.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('👥')) lines[i] = `👥 **Участников сейчас: ${lotteryParticipants.size}**`;
      if (lines[i].startsWith('🏆')) lines[i] = `🏆 **Текущий призовой фонд: ${currentPrize} коинов**`;
    }

    embed.setDescription(lines.join('\n'));
    await lotteryMessage.edit({ embeds: [embed] });
  });

  lotteryInterval = setInterval(async () => {
    try {
      const currentPrize = INITIAL_PRIZE + lotteryParticipants.size * LOTTERY_ENTRY_COST;
      const oldEmbed = lotteryMessage.embeds[0];
      const embed = EmbedBuilder.from(oldEmbed);
      const lines = oldEmbed.description.split('\n');

      lines.forEach((line, i) => {
        if (line.startsWith('👥')) lines[i] = `👥 **Участников сейчас: ${lotteryParticipants.size}**`;
        if (line.startsWith('🏆')) lines[i] = `🏆 **Текущий призовой фонд: ${currentPrize} коинов**`;
      });

      embed.setDescription(lines.join('\n'));

      if (lotteryParticipants.size === 0) {
        embed.setFields([]);
        await lotteryMessage.edit({ embeds: [embed] });
        return;
      }

      const winnerArray = Array.from(lotteryParticipants);
      const winnerId = winnerArray[Math.floor(Math.random() * winnerArray.length)];
      const winnerUser = await client.users.fetch(winnerId);

      if (!data.coinsData[winnerId]) {
        data.coinsData[winnerId] = { coins: 0, promocode: null, usedPromocode: null };
      }

      data.coinsData[winnerId].coins += currentPrize;
      saveData();
      lotteryWinCount++;

      embed.setFields([{
        name: '🎊 У нас есть победитель!',
        value:
          `🏆 Победителем становится — <@${winnerId}>!\n` +
          `💰 Он получает **${currentPrize} коинов**!\n\n` +
          `🔢 **Это был розыгрыш №${lotteryWinCount} этой безумной лотереи!**\n` +
          `🎉 **Поздравляем! Следующий розыгрыш уже скоро!**`,
        inline: false,
      }]);

      await lotteryMessage.edit({ embeds: [embed] });
      await lotteryMessage.reactions.removeAll();
      await lotteryMessage.react('🎟️');
      lotteryParticipants.clear();

    } catch (err) {
      console.error('Ошибка в лотерее:', err);
    }
  }, 86_400_000); // каждые 24 часа
}

// ===============================
// 💰 БЛОК 5: СЕМЕЙНЫЕ КОМАНДЫ
// ===============================
else if (command === 'create_fam') {
  if (!message.member.roles.cache.has(CUR_MOD_ROLE_ID)) {
    return sendError(message, 'У вас нет прав для создания фамы.');
  }

  await message.delete().catch(() => {});

  // Функция для запроса текста
  async function ask(prompt) {
    const promptMsg = await message.channel.send({
      embeds: [createEmbed({ title: '🛠️ Создание семьи', description: prompt })]
    });

    try {
      const collected = await message.channel.awaitMessages({
        filter: m => m.author.id === message.author.id,
        max: 1,
        time: 60000,
        errors: ['time']
      });

      const reply = collected.first();
      await reply.delete().catch(() => {});
      await promptMsg.delete().catch(() => {});
      return reply.content.trim();
    } catch {
      await promptMsg.delete().catch(() => {});
      const timeoutMsg = await message.channel.send({
        embeds: [createEmbed({ title: '⏰ Время вышло', description: 'Создание семьи отменено.', color: '#FF5555' })]
      });
      setTimeout(() => timeoutMsg.delete().catch(() => {}), 5000);
      throw new Error('Отмена');
    }
  }

  // Функция для запроса с кнопками (исправлена)
  async function askButton(prompt, buttons) {
    const row = new ActionRowBuilder().addComponents(
      buttons.map(b => {
        const button = new ButtonBuilder()
          .setCustomId(b.id)
          .setLabel(b.label)
          .setStyle(b.style);
        if (b.emoji) button.setEmoji(b.emoji);
        return button;
      })
    );

    const msg = await message.channel.send({
      embeds: [createEmbed({ title: '🛠️ Создание семьи', description: prompt })],
      components: [row]
    });

    try {
      const interaction = await msg.awaitMessageComponent({
        filter: i => i.user.id === message.author.id,
        time: 60000
      });

      await interaction.deferUpdate();
      await msg.delete().catch(() => {});
      return interaction.customId;
    } catch {
      await msg.delete().catch(() => {});
      const timeoutMsg = await message.channel.send({
        embeds: [createEmbed({ title: '⏰ Время вышло', description: 'Создание семьи отменено.', color: '#FF5555' })]
      });
      setTimeout(() => timeoutMsg.delete().catch(() => {}), 5000);
      throw new Error('Отмена');
    }
  }

  try {
    // Запрос владельца семьи
    const ownerRaw = await ask('Упомяни владельца семьи:');
    const ownerId = (ownerRaw.match(/^<@!?(\d+)>$/) || [])[1];
    if (!ownerId) return sendError(message, 'Упоминание владельца не распознано.');
    const ownerMember = await message.guild.members.fetch(ownerId).catch(() => null);
    if (!ownerMember) return sendError(message, 'Участник не найден.');

    // Проверка, что у пользователя нет семьи
    const existingFam = Object.values(data.families || {}).find(f => f.ownerId === ownerId);
    if (existingFam) return sendError(message, 'У этого пользователя уже есть семья.');

    // Запрос названия семьи
    const familyName = await ask('Введи название семьи (до 30 символов):');
    if (familyName.length > 30) return sendError(message, 'Название слишком длинное.');

    // Запрос цвета в HEX
    let color = await ask('Введи цвет семьи в HEX (например: `#3498db`):');
    color = color.trim().toLowerCase();
    if (!/^#?[0-9a-f]{6}$/.test(color)) return sendError(message, 'Неверный формат цвета. Используйте HEX без прозрачности, например: #3498db');
    if (!color.startsWith('#')) color = `#${color}`;

    // Добавить смайлы? (кнопки)
    const emojiChoice = await askButton(
      '**Добавить смайлы в название семьи?**',
      [
        { id: 'yes', label: 'Да', style: ButtonStyle.Success },
        { id: 'no', label: 'Нет', style: ButtonStyle.Danger }
      ]
    );

    let emojis = [];
    let roleName = `[FAM] ${familyName}`;

    if (emojiChoice === 'yes') {
      const emojisRaw = await ask('Введи смайлы через пробел:');
      emojis = emojisRaw.split(/\s+/).filter(e => e);

      // Выбор расположения смайлов (кнопки)
      const placement = await askButton(
        '**🎨 Куда вставить смайлы в названии?**',
        [
          { id: 'start', label: 'В начале', style: ButtonStyle.Primary },
          { id: 'end', label: 'В конце', style: ButtonStyle.Primary },
          { id: 'both', label: 'По бокам', style: ButtonStyle.Primary }
        ]
      );

      if (placement === 'start') {
        roleName = `${emojis.join(' ')} [FAM] ${familyName}`;
      } else if (placement === 'end') {
        roleName = `[FAM] ${familyName} ${emojis.join(' ')}`;
      } else if (placement === 'both') {
        roleName = `${emojis.join(' ')} [FAM] ${familyName} ${emojis.join(' ')}`;
      }
    }

    // Запрос цены
    const priceStr = await ask('Укажи цену создания семьи (в коинах):');
    const price = parseInt(priceStr);
    if (isNaN(price) || price <= 0) return sendError(message, 'Неверное число.');

    // Подтверждение создания семьи
    const preview = `🔹 Название: \`${roleName}\`\n🔹 Цвет: \`${color}\`\n🔹 Смайлы: ${emojis.length ? emojis.join(' ') : '—'}\n🔹 Цена: \`${price} коинов\`\n🔹 Владелец: <@${ownerId}>`;

    const confirm = await askButton(preview + '\n\nПодтвердите создание семьи:', [
      { id: 'confirm', label: 'Подтвердить', style: ButtonStyle.Success },
      { id: 'cancel', label: 'Отменить', style: ButtonStyle.Danger }
    ]);

    if (confirm === 'cancel') throw new Error('Отмена пользователем');

    // Проверка и списание коинов
    if (!data.coinsData[ownerId]) data.coinsData[ownerId] = { coins: 0 };
    if (data.coinsData[ownerId].coins < price) return sendError(message, 'У владельца недостаточно коинов.');

    data.coinsData[ownerId].coins -= price;
    saveData();

    // Создаём роль семьи
    const role = await message.guild.roles.create({
      name: roleName,
      color,
      mentionable: true,
      hoist: true
    });

    // Позиция роли ниже базовой семьи
    const referenceRole = message.guild.roles.cache.get(FAM_ROLE_ID);
    if (referenceRole) {
      await role.setPosition(referenceRole.position - 1).catch(console.error);
    }

    // Добавляем роль владельцу
    await ownerMember.roles.add(role);

    // Создаём канал семьи
    const centerChannel = message.guild.channels.cache.find(c => c.name === 'семейный-центр');
    const position = centerChannel?.position || 0;

    const channel = await message.guild.channels.create({
      name: familyName.toLowerCase().replace(/\s+/g, '-'),
      type: 0,
      parent: FAM_CATEGORY_ID,
      position: Math.max(0, position - 1),
      permissionOverwrites: [
        { id: message.guild.id, deny: ['ViewChannel'] },
        { id: role.id, allow: ['ViewChannel'] }
      ]
    });

    // Срок действия 30 дней
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    // Добавляем семью в data
    if (!data.families) data.families = {};
    data.families[role.id] = {
      ownerId,
      name: familyName,
      emojis,
      color,
      price,
      channelId: channel.id,
      expiresAt,
      warned: false
    };
    saveData();

    // Логика создания/обновления общего канала 'общий-семей'
    const famRoles = Object.keys(data.families).filter(rid => message.guild.roles.cache.has(rid));
    const generalChannel = message.guild.channels.cache.find(c => c.name === 'общий-семей');

    if (famRoles.length === 1) {
      // Если одна семья — закрываем общий канал
      if (generalChannel) {
        await generalChannel.permissionOverwrites.edit(message.guild.id, { ViewChannel: false });
        for (const rid of famRoles) {
          await generalChannel.permissionOverwrites.edit(rid, { ViewChannel: false, SendMessages: false });
        }
      }
    } else if (famRoles.length === 2) {
      // При двух семьях — создаём общий канал (если нет) и даём доступ
      if (!generalChannel) {
        const newCenter = await message.guild.channels.create({
          name: 'общий-семей',
          type: 0,
          parent: FAM_CATEGORY_ID,
          permissionOverwrites: [
            { id: message.guild.id, deny: ['ViewChannel'] },
            ...famRoles.map(rid => ({
              id: rid,
              allow: ['ViewChannel', 'SendMessages']
            }))
          ]
        });
        await newCenter.setPosition(100);
      } else {
        for (const rid of famRoles) {
          await generalChannel.permissionOverwrites.edit(rid, {
            ViewChannel: true,
            SendMessages: true
          });
        }
      }
    } else if (famRoles.length > 2) {
      // При трёх и более семьях просто добавляем доступ в общий канал
      if (generalChannel) {
        for (const rid of famRoles) {
          await generalChannel.permissionOverwrites.edit(rid, {
            ViewChannel: true,
            SendMessages: true
          });
        }
      }
    }

    // Отправляем сообщение об успешном создании семьи
    await message.channel.send({
      embeds: [createEmbed({
        title: '🏡 Семья успешно создана!',
        color,
        description:
          `**📛 Название семьи:** \`${roleName}\`\n` +
          `**👑 Владелец семьи:** <@${ownerId}>\n` +
          `**📁 Канал семьи:** <#${channel.id}>\n` +
          `**🎨 Цвет роли:** \`${color}\`\n` +
          `**💰 Стоимость семьи:** \`${price} коинов\`\n` +
          `**⏳ Срок действия:** \`30 дней\`\n` +
          `**🎉 Смайлики:** ${emojis.length ? emojis.join(' ') : '—'}\n` +
          `**👮‍♂️ Создано модератором:** <@${message.author.id}>`
      })]
    });

  } catch (e) {
    if (e.message !== 'Отмена') {
      console.error(e);
      await sendError(message, 'Произошла ошибка при создании семьи.');
    }
  }
}
else if (command === 'delete_fam') {
  if (!message.member.roles.cache.has(MAIN_MOD_ROLE_ID)) {
    return sendError(message, 'У вас нет прав для удаления семей.');
  }

  await message.delete().catch(() => {});

  const roleMention = args[0];
  const reason = args.slice(1).join(' ').trim();
  const roleId = roleMention?.replace(/[<@&>]/g, '');

  if (!roleId || !reason) {
    return sendError(message, 'Используйте: `/delete_fam @роль причина`');
  }

  const fam = data.families?.[roleId];
  if (!fam) return sendError(message, 'Семья с этой ролью не найдена.');

  const confirmMsg = await message.channel.send({
    embeds: [createEmbed({
      title: '⚠️ Подтверждение удаления семьи',
      color: '#F1C40F',
      description:
        `Вы собираетесь удалить семью:\n\n` +
        `**🏷️ Название:** \`[FAM] ${fam.name}\`\n` +
        `**👑 Владелец:** <@${fam.ownerId}>\n` +
        `**📄 Причина:** ${reason}\n\n` +
        `Нажмите ✅ для подтверждения или ❌ для отмены.`
    })]
  });

  await confirmMsg.react('✅');
  await confirmMsg.react('❌');

  const reaction = await confirmMsg.awaitReactions({
    filter: (r, u) => ['✅', '❌'].includes(r.emoji.name) && u.id === message.author.id,
    max: 1,
    time: 30000
  });

  await confirmMsg.delete().catch(() => {});
  const choice = reaction.first().emoji.name;

  if (choice === '❌') {
    return message.channel.send({
      embeds: [createEmbed({
        title: '❌ Удаление отменено',
        color: '#95A5A6',
        description: 'Удаление семьи было отменено пользователем.'
      })]
    });
  }

  const role = message.guild.roles.cache.get(roleId);
  const channel = message.guild.channels.cache.get(fam.channelId);

  if (channel) await channel.delete().catch(() => {});
  if (role) await role.delete().catch(() => {});

  delete data.families[roleId];
  saveData();

await message.channel.send({
  embeds: [createEmbed({
    title: '🗑️ Семья удалена',
    color: '#E74C3C',
    description:
      `**🏷️ Название:** \`[FAM] ${fam.name}\`\n` +
      `**👑 Владелец:** <@${fam.ownerId}>\n` +
      `**👮‍♂️ Удалил модератор:** <@${message.author.id}>\n` +
      `**📄 Причина:** ${reason}\n` +
      `**📆 Дата:** <t:${Math.floor(Date.now() / 1000)}:f>`
  })]
});

const owner = await client.users.fetch(fam.ownerId).catch(() => null);
if (owner) {
  owner.send({
    embeds: [createEmbed({
      title: '📪 Ваша семья была удалена',
      color: '#E74C3C',
      description:
        `Ваша семья \`[FAM] ${fam.name}\` была удалена модерацией.\n\n` +
        `**📄 Причина:** ${reason}\n` +
        `**👮‍♂️ Модератор:** <@${message.author.id}>\n` +
        `**📆 Дата:** <t:${Math.floor(Date.now() / 1000)}:f>`
    })]
  }).catch(() => {});
}

  const remainingRoles = Object.keys(data.families || {});
  const centerChannel = message.guild.channels.cache.find(c => c.name === 'семейный-центр');

  if (centerChannel) {
    if (remainingRoles.length < 2) {
      await centerChannel.permissionOverwrites.set([
        { id: message.guild.id, deny: ['ViewChannel'] }
      ]);
    } else {
      const updatedPermissions = [
        { id: message.guild.id, deny: ['ViewChannel'] },
        ...remainingRoles.map(roleId => ({
          id: roleId,
          allow: ['ViewChannel', 'SendMessages']
        }))
      ];
      await centerChannel.permissionOverwrites.set(updatedPermissions);
    }
  }
}
else if (command === 'extend_fam') {
  await message.delete().catch(() => {});

  const userId = message.author.id;

  const famEntry = Object.entries(data.families || {}).find(([, fam]) => fam.ownerId === userId);
  if (!famEntry) {
    const msg = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Нет семьи',
        description: 'У вас нет своей семьи для продления.',
        color: '#E74C3C'
      })]
    });
    return setTimeout(() => msg.delete().catch(() => {}), 7000);
  }

  const [roleId, fam] = famEntry;
  const renewCost = Math.floor(fam.price * 0.2);
  if (fam.bank === undefined) fam.bank = 0;

  const row = {
    type: 1,
    components: [
      {
        type: 2,
        style: 1,
        label: `💳 Со счёта (${renewCost}₽)`,
        custom_id: 'extend_personal'
      },
      {
        type: 2,
        style: 3,
        label: `🏦 Из банка семьи (${renewCost}₽)`,
        custom_id: 'extend_fam_bank'
      },
      {
        type: 2,
        style: 4,
        label: '❌ Отмена',
        custom_id: 'cancel_extend'
      }
    ]
  };

  const prompt = await message.channel.send({
    embeds: [createEmbed({
      title: '🔁 Продление семьи',
      description: `Выберите, откуда списать **${renewCost.toLocaleString('ru-RU')}** коинов за продление семьи \`[FAM] ${fam.name}\`.`,
      color: '#6A5ACD'
    })],
    components: [row]
  });

  const filter = i => i.user.id === userId && ['extend_personal', 'extend_fam_bank', 'cancel_extend'].includes(i.customId);
  const collector = prompt.createMessageComponentCollector({ filter, time: 15000, max: 1 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();
    let success = false;

    if (interaction.customId === 'cancel_extend') {
      await prompt.edit({
        embeds: [createEmbed({ title: '❌ Отменено', description: 'Продление отменено.', color: '#E67E22' })],
        components: []
      });
      setTimeout(() => prompt.delete().catch(() => {}), 7000);
      return;
    }

    if (interaction.customId === 'extend_personal') {
      if (!data.coinsData[userId] || data.coinsData[userId].coins < renewCost) {
        await interaction.editReply({
          embeds: [createEmbed({
            title: '💸 Недостаточно средств',
            description: `На вашем счёте недостаточно коинов (**нужно ${renewCost}**)`,
            color: '#E67E22'
          })],
          components: []
        });
        setTimeout(() => prompt.delete().catch(() => {}), 7000);
        return;
      }
      data.coinsData[userId].coins -= renewCost;
      success = true;
    }

    if (interaction.customId === 'extend_fam_bank') {
      if (fam.bank < renewCost) {
        await interaction.editReply({
          embeds: [createEmbed({
            title: '🏦 Недостаточно в банке',
            description: `В банке семьи недостаточно средств (**нужно ${renewCost}**)`,
            color: '#E67E22'
          })],
          components: []
        });
        setTimeout(() => prompt.delete().catch(() => {}), 7000);
        return;
      }
      fam.bank -= renewCost;
      success = true;
    }

    if (success) {
      fam.expiresAt += 30 * 24 * 60 * 60 * 1000;
      saveData();

      await prompt.edit({
        embeds: [createEmbed({
          title: '✅ Семья продлена!',
          description: `Семья \`[FAM] ${fam.name}\` продлена на **30 дней**.\n\n📅 Новый срок: <t:${Math.floor(fam.expiresAt / 1000)}:f>`,
          color: '#2ECC71'
        })],
        components: []
      });
      setTimeout(() => prompt.delete().catch(() => {}), 7000);
    }
  });

  collector.on('end', collected => {
    if (collected.size === 0) {
      prompt.edit({
        embeds: [createEmbed({ title: '⏰ Время истекло', description: 'Продление семьи не было выбрано.', color: '#E67E22' })],
        components: []
      });
      setTimeout(() => prompt.delete().catch(() => {}), 7000);
    }
  });
}
else if (command === 'fam_info') {
  await message.delete().catch(() => {});

  const userId = message.author.id;
  const famEntry = Object.entries(data.families || {}).find(
    ([, fam]) => fam.ownerId === userId || (fam.members || []).includes(userId)
  );

  if (!famEntry) {
    const msg = await message.channel.send('❌ Вы не состоите ни в одной семье.');
    return setTimeout(() => msg.delete().catch(() => {}), 7000);
  }

  const [roleId, fam] = famEntry;
  const guild = message.guild;
  const role = guild.roles.cache.get(roleId);

  const ownerMember = await guild.members.fetch(fam.ownerId).catch(() => null);
  const ownerName = ownerMember ? ownerMember.displayName : `<@${fam.ownerId}>`;

  const roleMention = role ? role.name : fam.name;
  const roleColorHex = role ? `#${role.color.toString(16).padStart(6, '0')}` : '#f7dc6f';
  const memberCount = role ? role.members.size : 0;

  const deputyLines = ['отсутствует', 'отсутствует', 'отсутствует'];
  let i = 0;
  for (const deputyId of fam.deputies || []) {
    if (i >= 3) break;
    const member = await guild.members.fetch(deputyId).catch(() => null);
    if (member) {
      deputyLines[i] = member.displayName || `<@${deputyId}>`;
      i++;
    }
  }

  const formattedDate = new Date(fam.expiresAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).replace(' г.,', '').replace(' г.', '');

  function declOfNum(number, titles) {
    number = Math.abs(number) % 100;
    const n1 = number % 10;
    if (number > 10 && number < 20) return titles[2];
    if (n1 > 1 && n1 < 5) return titles[1];
    if (n1 === 1) return titles[0];
    return titles[2];
  }

  const canvasWidth = 1100;
  const canvasHeight = 500;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Фон с градиентом
  const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bgGradient.addColorStop(0, '#121417');
  bgGradient.addColorStop(1, '#25282f');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Шумовой слой для текстуры
  const noiseCanvas = createCanvas(canvasWidth, canvasHeight);
  const noiseCtx = noiseCanvas.getContext('2d');
  const imageData = noiseCtx.createImageData(canvasWidth, canvasHeight);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.random() * 30;
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 15;
  }
  noiseCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(noiseCanvas, 0, 0);

  const cardX = 40;
  const cardY = 40;
  const cardWidth = canvasWidth - 80;
  const cardHeight = canvasHeight - 80;
  const cardRadius = 30;

  // Тень и фон карточки
  ctx.shadowColor = 'rgba(255, 204, 53, 0.2)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#2a2d37cc';
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.fill();

  ctx.shadowBlur = 0;


  const borderGradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
  borderGradient.addColorStop(0, roleColorHex);
  borderGradient.addColorStop(0.5, '#f7dc6f');
  borderGradient.addColorStop(1, roleColorHex);

  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 12;
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.stroke();


  const avatar = await loadImage(ownerMember
    ? ownerMember.displayAvatarURL({ extension: 'png', size: 256 })
    : message.author.displayAvatarURL({ extension: 'png', size: 256 }));

  const avatarX = 70;
  const avatarY = 180;
  const avatarSize = 180;


  ctx.shadowColor = 'rgba(247, 156, 18, 0.6)';
  ctx.shadowBlur = 20;
  ctx.roundRect(avatarX - 12, avatarY - 12, avatarSize + 24, avatarSize + 24, 24);
  ctx.fillStyle = '#191a1f';
  ctx.fill();
  ctx.shadowBlur = 0;


  const avatarBorderGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize * 1.5, avatarY + avatarSize * 1.5);
  avatarBorderGrad.addColorStop(0, roleColorHex);
  avatarBorderGrad.addColorStop(1, '#f7dc6f');

  ctx.strokeStyle = avatarBorderGrad;
  ctx.lineWidth = 8;
  ctx.roundRect(avatarX - 12, avatarY - 12, avatarSize + 24, avatarSize + 24, 24);
  ctx.stroke();


  ctx.save();
  ctx.beginPath();
  ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 20);
  ctx.clip();
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

 
  const bankAmount = fam.bank || 0;
  const bankCoinsWord = declOfNum(bankAmount, ['коин', 'коина', 'коинов']);

  const infoX = 280;
  const infoY = 160;
  const lineHeight = 43;

  ctx.font = '600 26px Arial';

  const infoItems = [
    ['👑 Владелец', ownerName],
    ['🥇 Первый заместитель', deputyLines[0]],
    ['🥈 Второй заместитель', deputyLines[1]],
    ['🥉 Третий заместитель', deputyLines[2]],
    ['👥 Участников', memberCount.toString()],
    ['💰 Банк семьи', `${bankAmount.toLocaleString('ru-RU')} ${bankCoinsWord}`],
    ['📅 Действует до', formattedDate]
  ];

  for (let i = 0; i < infoItems.length; i++) {
    const [label, value] = infoItems[i];
    const y = infoY + i * lineHeight;

 
    ctx.shadowColor = 'rgba(247, 220, 111, 0.4)';
    ctx.shadowBlur = 8;

    ctx.fillStyle = 'rgba(247, 220, 111, 0.7)';
    ctx.fillText(label + ':', infoX, y);

    ctx.shadowBlur = 0; 

    const labelWidth = ctx.measureText(label + ':').width + 20;


    ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
    ctx.shadowBlur = 6;

    const valueGradient = ctx.createLinearGradient(infoX + labelWidth, y, infoX + labelWidth + 300, y);
    valueGradient.addColorStop(0, 'rgba(201, 198, 198, 0.8)');
    valueGradient.addColorStop(1, 'rgba(255, 255, 255, 0.9)');

    ctx.fillStyle = valueGradient;

    let displayValue = value;
    const maxWidth = cardWidth - (infoX + labelWidth) - 40;
    if (ctx.measureText(displayValue).width > maxWidth) {
      while (ctx.measureText(displayValue + '…').width > maxWidth) {
        displayValue = displayValue.slice(0, -1);
      }
      displayValue += '…';
    }

    ctx.fillText(displayValue, infoX + labelWidth, y);
    ctx.shadowBlur = 0; 
  }

 
 ctx.font = 'bold 52px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

let title = roleMention;
const maxTitleWidth = cardWidth - 100;

// Обрезка, если текст слишком длинный
if (ctx.measureText(title).width > maxTitleWidth) {
  while (ctx.measureText(title + '…').width > maxTitleWidth) {
    title = title.slice(0, -1);
  }
  title += '…';
}

const titleX = cardX + cardWidth / 2;
const titleY = cardY + 55;

const titleGradient = ctx.createLinearGradient(titleX - 200, titleY, titleX + 200, titleY);
titleGradient.addColorStop(0, '#f7dc6f');
titleGradient.addColorStop(0.5, '#ffae00');
titleGradient.addColorStop(1, '#f7dc6f');

ctx.fillStyle = titleGradient;
ctx.shadowColor = 'rgba(255, 174, 0, 0.8)';
ctx.shadowBlur = 16;
ctx.fillText(title, titleX, titleY);
ctx.shadowBlur = 0;


  const buffer = canvas.toBuffer('image/png');
  const attachment = new AttachmentBuilder(buffer, { name: 'fam_info.png' });

  const infoMsg = await message.channel.send({ files: [attachment] });
  setTimeout(() => infoMsg.delete().catch(() => {}), 15000);
}
else if (command === 'fam_bank'){
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});
  if (!args[0] || isNaN(args[0])) {
    await message.delete().catch(() => {});
    return sendError(message, '💡 Укажите сумму для пополнения банка семьи.\nПример: `/fam_deposit 1000`');
  }

  await message.delete().catch(() => {}); 

  const amount = parseInt(args[0]);
  if (amount <= 0) {
    return sendError(message, '💡 Сумма должна быть положительным числом.');
  }

  const userId = message.author.id;
  const userCoins = data.coinsData[userId]?.coins || 0;

  if (userCoins < amount) {
    return sendError(message, '💸 У вас недостаточно коинов.');
  }


  const userFamEntry = Object.entries(data.families || {}).find(([roleId]) => {
    const role = message.guild.roles.cache.get(roleId);
    return role?.members.has(userId);
  });

  if (!userFamEntry) {
    return sendError(message, '😕 Вы не состоите ни в одной семье.');
  }

  const [famRoleId, fam] = userFamEntry;


  if (fam.bank === undefined) fam.bank = 0;


  data.coinsData[userId].coins -= amount;
  fam.bank += amount;
  saveData();


  const embed = createEmbed({
    title: '🏦 Банк семьи пополнен',
    description: `✅ Вы внесли **${amount.toLocaleString('ru-RU')}** коинов в банк семьи **${fam.name}**.`,
    color: '#2ECC71',
    footerText: `Пополнение от ${message.member.displayName}`
  });

  const reply = await message.channel.send({ embeds: [embed] });
  setTimeout(() => reply.delete().catch(() => {}), 10000);
}
else if (command === 'a_fam') {
  await message.delete().catch(() => {});

  const targetMention = args[0];
  const targetId = targetMention?.replace(/[<@!>]/g, '');
  const target = await message.guild.members.fetch(targetId).catch(() => null);

  if (!target) {
    const err = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Ошибка',
        description: 'Указанный пользователь не найден.',
        color: '#E74C3C'
      })]
    });
    return setTimeout(() => err.delete().catch(() => {}), 7000);
  }

  const userId = message.author.id;
  const famEntry = Object.entries(data.families || {}).find(([, fam]) =>
    fam.ownerId === userId || (Array.isArray(fam.deputies) && fam.deputies.includes(userId))
  );

  if (!famEntry) {
    const warn = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Нет семьи',
        description: 'Вы не являетесь владельцем или заместителем какой-либо семьи.',
        color: '#E74C3C'
      })]
    });
    return setTimeout(() => warn.delete().catch(() => {}), 7000);
  }

  const [roleId, fam] = famEntry;
  const role = message.guild.roles.cache.get(roleId);

  if (!role) {
    const err = await message.channel.send({
      embeds: [createEmbed({
        title: '⚠️ Роль не найдена',
        description: 'Роль семьи не найдена на сервере.',
        color: '#F1C40F'
      })]
    });
    return setTimeout(() => err.delete().catch(() => {}), 7000);
  }

  const targetAlreadyHasFamily = Object.values(data.families || {}).some(f => {
    const famRole = message.guild.roles.cache.get(f.roleId);
    return famRole && target.roles.cache.has(famRole.id);
  });

  if (targetAlreadyHasFamily) {
    const warn = await message.channel.send({
      embeds: [createEmbed({
        title: '🚫 Уже в семье',
        description: `<@${targetId}> уже состоит в другой семье и не может быть добавлен.`,
        color: '#E67E22'
      })]
    });
    return setTimeout(() => warn.delete().catch(() => {}), 7000);
  }

  await target.roles.add(role).catch(() => {});

  const done = await message.channel.send({
    embeds: [createEmbed({
      title: '✅ Участник добавлен в семью',
      color: '#2ECC71',
      description:
        `<@${targetId}> теперь состоит в семье \`[FAM] ${fam.name}\`.\n` +
        `👤 Добавлено: <@${userId}>`
    })]
  });

  setTimeout(() => done.delete().catch(() => {}), 7000);
}
else if (command === 'd_fam') {
  await message.delete().catch(() => {});

  const targetMention = args[0];
  const targetId = targetMention?.replace(/[<@!>]/g, '');
  const target = await message.guild.members.fetch(targetId).catch(() => null);

  if (!target) {
    const err = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Ошибка',
        description: 'Указанный пользователь не найден.',
        color: '#E74C3C'
      })]
    });
    return setTimeout(() => err.delete().catch(() => {}), 7000);
  }

  const userId = message.author.id;
  const famEntry = Object.entries(data.families || {}).find(([, fam]) =>
    fam.ownerId === userId || (Array.isArray(fam.deputies) && fam.deputies.includes(userId))
  );

  if (!famEntry) {
    const warn = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Нет семьи',
        description: 'Вы не являетесь владельцем или заместителем какой-либо семьи.',
        color: '#E74C3C'
      })]
    });
    return setTimeout(() => warn.delete().catch(() => {}), 7000);
  }

  const [roleId, fam] = famEntry;
  const role = message.guild.roles.cache.get(roleId);

  if (!role || !target.roles.cache.has(roleId)) {
    const warn = await message.channel.send({
      embeds: [createEmbed({
        title: 'ℹ️ Не в семье',
        description: `<@${targetId}> не состоит в вашей семье.`,
        color: '#F39C12'
      })]
    });
    return setTimeout(() => warn.delete().catch(() => {}), 7000);
  }

  await target.roles.remove(role).catch(() => {});

  const msg = await message.channel.send({
    embeds: [createEmbed({
      title: '🚫 Участник исключён',
      color: '#E74C3C',
      description:
        `<@${targetId}> был исключён из семьи \`[FAM] ${fam.name}\`.\n` +
        `👤 Исключил: <@${userId}>`
    })]
  });

  setTimeout(() => msg.delete().catch(() => {}), 7000);
}
else if (command === 'a_zam') {
  await message.delete().catch(() => {});

  const mention = args[0];
  const positionStr = args[1];

  const targetId = mention?.replace(/[<@!>]/g, '');
  const target = await message.guild.members.fetch(targetId).catch(() => null);
  const pos = parseInt(positionStr);

  if (!target || ![1, 2, 3].includes(pos)) {
    const err = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Неверный ввод',
        description: 'Используйте: `!a_zam @пользователь 1/2/3`',
        color: '#E74C3C'
      })]
    });
    return setTimeout(() => err.delete().catch(() => {}), 7000);
  }

  const userId = message.author.id;
  const famEntry = Object.entries(data.families || {}).find(([, fam]) => fam.ownerId === userId);
  if (!famEntry) {
    const warn = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Доступ запрещен',
        description: 'Вы не являетесь владельцем семьи.',
        color: '#E74C3C'
      })]
    });
    return setTimeout(() => warn.delete().catch(() => {}), 7000);
  }

  const [roleId, fam] = famEntry;

  if (!target.roles.cache.has(roleId)) {
    const err = await message.channel.send({
      embeds: [createEmbed({
        title: '⚠️ Ошибка',
        description: 'Вы можете назначить заместителем только участника вашей семьи.',
        color: '#F39C12'
      })]
    });
    return setTimeout(() => err.delete().catch(() => {}), 7000);
  }

  if (!fam.deputies) fam.deputies = [];

  const currentDeputy = fam.deputies[pos - 1];
  let action = '';

  if (currentDeputy === targetId) {
    fam.deputies[pos - 1] = null; // снять
    action = `🔻 Заместитель #${pos} снят: <@${targetId}>`;
  } else {
    fam.deputies[pos - 1] = targetId; // назначить
    action = `✅ Назначен заместитель #${pos}: <@${targetId}>`;
  }

  fam.deputies = fam.deputies.map(d => d || null);
  saveData();

  const result = await message.channel.send({
    embeds: [createEmbed({
      title: '🛠 Управление заместителями',
      description: action,
      color: '#3498DB'
    })]
  });

  setTimeout(() => result.delete().catch(() => {}), 7000);
}
else if (command === 'd_zam') {
  await message.delete().catch(() => {});

  const mention = args[0];
  const targetId = mention?.replace(/[<@!>]/g, '');
  if (!targetId) {
    const err = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Укажите пользователя',
        description: 'Используйте: `/remove_deputy @пользователь`',
        color: '#E74C3C'
      })]
    });
    return setTimeout(() => err.delete().catch(() => {}), 7000);
  }

  const userId = message.author.id;
  const famEntry = Object.entries(data.families || {}).find(([, fam]) => fam.ownerId === userId);
  if (!famEntry) {
    const warn = await message.channel.send({
      embeds: [createEmbed({
        title: '❌ Доступ запрещён',
        description: 'Только владелец семьи может снимать заместителей.',
        color: '#E74C3C'
      })]
    });
    return setTimeout(() => warn.delete().catch(() => {}), 7000);
  }

  const [roleId, fam] = famEntry;
  if (!fam.deputies || !fam.deputies.includes(targetId)) {
    const err = await message.channel.send({
      embeds: [createEmbed({
        title: 'ℹ️ Пользователь не является заместителем',
        description: `<@${targetId}> не является заместителем вашей семьи.`,
        color: '#F1C40F'
      })]
    });
    return setTimeout(() => err.delete().catch(() => {}), 7000);
  }

  fam.deputies = fam.deputies.filter(id => id !== targetId);
  saveData();

  const done = await message.channel.send({
    embeds: [createEmbed({
      title: '🔻 Заместитель снят',
      description: `Пользователь <@${targetId}> больше не является заместителем.`,
      color: '#3498DB'
    })]
  });

  setTimeout(() => done.delete().catch(() => {}), 7000);
}
else if (command === 'transfer_fam') {
  await message.delete().catch(() => {});

  const senderId = message.author.id;
  const targetMention = args[0];
  const price = parseInt(args[1], 10);

  if (!targetMention || isNaN(price) || price <= 0) {
    return sendWarning(message, '❗ Использование: `!transfer_fam @пользователь <цена>`');
  }

  const targetId = targetMention.replace(/[<@!>]/g, '');
  const target = await message.guild.members.fetch(targetId).catch(() => null);

  if (!target) return sendError(message, '❌ Указанный пользователь не найден.');

  if (targetId === senderId) {
    return sendError(message, '❌ Вы не можете передать семью самому себе.');
  }

  const hasOwnFam = Object.values(data.families || {}).some(f => f.ownerId === targetId);
  if (hasOwnFam) {
    return sendError(message, `❌ У <@${targetId}> уже есть своя семья. Передача невозможна.`);
  }

  const famEntry = Object.entries(data.families || {}).find(([, fam]) => fam.ownerId === senderId);
  if (!famEntry) return sendError(message, '❌ У вас нет своей семьи для передачи.');

  const [famRoleId, fam] = famEntry;

  if (!data.coinsData) data.coinsData = {};
  if (!data.coinsData[targetId]) {
    data.coinsData[targetId] = {
      coins: 0, promocode: null, usedPromocode: null,
      deposit: 0, depositIncome: 0, status: "🌱 Начинающий"
    };
  }

  if (data.coinsData[targetId].coins < price) {
    return sendError(message, `❌ У <@${targetId}> недостаточно коинов.\nНужно: **${price.toLocaleString('ru-RU')}** коинов.`);
  }

  const confirmChannel = message.guild.channels.cache.get(MOD_CONFIRM_CHANNEL_ID);
  if (!confirmChannel) return sendError(message, '❌ Канал модерации не найден.');

  const confirmEmbed = new EmbedBuilder()
    .setColor('#F1C40F')
    .setTitle('📦 Запрос на передачу семьи')
    .setDescription(
      `📛 **Семья:** <@&${famRoleId}> (${fam.name})\n` +
      `👑 **Текущий владелец:** <@${senderId}>\n` +
      `➡ **Новый владелец:** <@${targetId}>\n` +
      `💰 **Стоимость:** ${price.toLocaleString('ru-RU')} коинов (снимается с нового владельца)\n\n` +
      `⚠️ Нажмите ✅ для подтверждения или ❌ для отказа.`
    )
    .setFooter({ text: `ID семьи: ${famRoleId}`, iconURL: message.guild.iconURL({ dynamic: true }) })
    .setTimestamp();

  const confirmMsg = await confirmChannel.send({ embeds: [confirmEmbed] });
  await confirmMsg.react('✅');
  await confirmMsg.react('❌');

  const collector = confirmMsg.createReactionCollector({
    filter: (reaction, user) =>
      ['✅', '❌'].includes(reaction.emoji.name) &&
      message.guild.members.cache.get(user.id)?.roles.cache.has(MOD_ROLE_ID),
    max: 1,
    time: 60000
  });

  collector.on('collect', async (reaction) => {
    if (reaction.emoji.name === '✅') {
      data.families[famRoleId].ownerId = targetId;
      data.coinsData[targetId].coins -= price;
      saveData();

      const oldOwner = await message.guild.members.fetch(senderId).catch(() => null);
      const newOwner = await message.guild.members.fetch(targetId).catch(() => null);
      const famRole = message.guild.roles.cache.get(famRoleId);

      if (famRole) {
        if (oldOwner) await oldOwner.roles.remove(famRole).catch(() => {});
        if (newOwner) await newOwner.roles.add(famRole).catch(() => {});
      }

      const successEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Передача семьи завершена')
        .setDescription(
          `👑 Семья <@&${famRoleId}> передана от <@${senderId}> к <@${targetId}>.\n` +
          `💸 С <@${targetId}> списано **${price.toLocaleString('ru-RU')}** коинов.`
        )
        .setTimestamp()
        .setFooter({ text: 'Семейная система', iconURL: message.guild.iconURL({ dynamic: true }) });

      await confirmMsg.edit({ embeds: [successEmbed] });
    } else {
      const cancelEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('❌ Передача отклонена')
        .setDescription('Модератор отклонил передачу семьи.')
        .setFooter({ text: 'Семейная система', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      await confirmMsg.edit({ embeds: [cancelEmbed] });
    }

    await confirmMsg.reactions.removeAll().catch(() => {});
  });

  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      const timeoutEmbed = new EmbedBuilder()
        .setColor('#FFAA00')
        .setTitle('⏰ Время истекло')
        .setDescription('Запрос на передачу семьи не был подтверждён модератором в течение 60 секунд.')
        .setFooter({ text: 'Семейная система', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      await confirmMsg.edit({ embeds: [timeoutEmbed] });
      await confirmMsg.reactions.removeAll().catch(() => {});
    }
  });
}
// ===============================
// 💰 БЛОК 6: МИНИ ИГРЫ
// ===============================
if (command === 'numbers') {
  if (message.channel.id !== COINS_CHANNEL_ID) {
    await message.delete().catch(() => {});
    return;
  }

  await message.delete().catch(() => {});

  const difficultyEmbed = new EmbedBuilder()
    .setTitle('🎲 Мини-игра: Выберите уровень сложности')
    .setDescription(
      'Нажмите на реакцию для выбора уровня сложности:\n' +
      '🟢 — easy (1-5)\n' +
      '🟡 — medium (1-10)\n' +
      '🔴 — hard (1-20)'
    )
    .setColor('#6A5ACD')
    .setFooter({ text: 'Выберите уровень сложности в течение 30 секунд' });

  const sentMsg = await message.channel.send({ embeds: [difficultyEmbed] });

  await sentMsg.react('🟢');
  await sentMsg.react('🟡');
  await sentMsg.react('🔴');

  const filter = (reaction, user) =>
    ['🟢', '🟡', '🔴'].includes(reaction.emoji.name) && user.id === message.author.id;

  try {
    const collected = await sentMsg.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] });
    const reaction = collected.first();

    const levels = {
      '🟢': 5,
      '🟡': 10,
      '🔴': 20,
    };

    const maxNumber = levels[reaction.emoji.name];

    const askNumberEmbed = new EmbedBuilder()
      .setTitle('🎲 Введите число')
      .setDescription(`Введите число от 1 до ${maxNumber} в чат.`)
      .setColor('#6A5ACD')
      .setFooter({ text: 'У вас есть 30 секунд на ввод числа.' });

    await sentMsg.edit({ embeds: [askNumberEmbed] });
    await sentMsg.reactions.removeAll().catch(() => {});

    const messageFilter = m => m.author.id === message.author.id;

    const collectedMessages = await message.channel.awaitMessages({ filter: messageFilter, max: 1, time: 30000, errors: ['time'] });
    const numberMsg = collectedMessages.first();

    await numberMsg.delete().catch(() => {});

    const guess = parseInt(numberMsg.content, 10);

    if (!Number.isInteger(guess) || guess < 1 || guess > maxNumber) {
      const errEmbed = new EmbedBuilder()
        .setTitle('❌ Ошибка')
        .setDescription(`Число должно быть целым и от 1 до ${maxNumber}. Попробуйте снова.`)
        .setColor('#FF0000');

      await message.channel.send({ embeds: [errEmbed] }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 10000);
      });
      await sentMsg.delete().catch(() => {});
      return;
    }

    const number = Math.floor(Math.random() * maxNumber) + 1;
    const isWin = guess === number;

    const resultEmbed = new EmbedBuilder()
      .setTitle('🎲 Результат игры: Угадай число')
      .setColor(isWin ? '#00FF00' : '#FF0000')
      .setDescription(
        `**Вы выбрали число:** ${guess}\n` +
        `**Сложность:** ${reaction.emoji.name} (от 1 до ${maxNumber})\n` +
        `**Бот загадал число:** ${number}\n\n` +
        (isWin ? '✅ Поздравляем! Вы угадали число!' : '❌ Увы, вы не угадали. Попробуйте ещё раз!')
      )
      .setFooter({ text: 'Сообщение удалится через 30 секунд' });

    await sentMsg.edit({ embeds: [resultEmbed] });

    setTimeout(() => sentMsg.delete().catch(() => {}), 30000);
  } catch {
    const timeoutEmbed = new EmbedBuilder()
      .setTitle('⌛ Время вышло')
      .setDescription('Вы не выбрали уровень сложности или не ввели число вовремя. Попробуйте снова.')
      .setColor('#FFA500');

    await sentMsg.edit({ embeds: [timeoutEmbed] });
    await sentMsg.reactions.removeAll().catch(() => {});
    setTimeout(() => sentMsg.delete().catch(() => {}), 30000);
  }
}
if (command === 'duel') {
  if (message.channel.id !== COINS_CHANNEL_ID) {
    return message.delete().catch(() => {});
  }

  const opponent = message.mentions.users.first();
  if (!opponent) {
    return message.reply('Укажи противника через упоминание.')
      .then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 30000);
      })
      .finally(() => message.delete().catch(() => {}));
  }
  if (opponent.id === message.author.id) {
    return message.reply('Нельзя вызвать дуэль самому себе.')
      .then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 30000);
      })
      .finally(() => message.delete().catch(() => {}));
  }

  const bet = parseInt(args[1]);
  if (!bet || bet <= 0) {
    return message.reply('Укажи корректную ставку числом.')
      .then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 30000);
      })
      .finally(() => message.delete().catch(() => {}));
  }

  message.delete().catch(() => {});

  const inviteEmbed = new EmbedBuilder()
    .setTitle('⚔️ Вызов на дуэль ⚔️')
    .setDescription(
      `${opponent}, храбрый воин, был вызван на бой от ${message.author}!\n` +
      `Ставка: **${bet}** коинов.\n\n` +
      `Прими вызов, нажав на реакцию ⚔️, и докажи свою доблесть!`
    )
    .setColor('#4B2E05')
    .setFooter({ text: 'У тебя есть 30 секунд, чтобы ответить.', iconURL: 'https://cdn-icons-png.flaticon.com/512/854/854878.png' });

  message.channel.send({ embeds: [inviteEmbed] }).then(async duelInvite => {
    await duelInvite.react('⚔️');

    const filter = (reaction, user) =>
      reaction.emoji.name === '⚔️' && user.id === opponent.id;

    duelInvite.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] })
      .then(collected => {
        duelInvite.delete().catch(() => {});

        const players = [message.author, opponent];
        const winner = players[Math.floor(Math.random() * players.length)];
        const loser = players.find(p => p.id !== winner.id);

        const resultEmbed = new EmbedBuilder()
          .setTitle('🏆 Победа в дуэли 🏆')
          .setDescription(
            `Великая битва между ${message.author} и ${opponent} завершилась!\n\n` +
            `✨ **Победитель:** ${winner}\n` +
            `💰 **Выигрыш:** ${bet * 2} коинов\n` +
            `⚔️ **Проигравший:** ${loser}`
          )
          .setColor('#BFA34A')
          .setFooter({ text: 'Пусть сила будет с тобой!', iconURL: 'https://cdn-icons-png.flaticon.com/512/854/854878.png' });

        message.channel.send({ embeds: [resultEmbed] }).then(msg => {
          setTimeout(() => msg.delete().catch(() => {}), 30000);
        });

      })
      .catch(() => {
        duelInvite.delete().catch(() => {});

        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏳ Дуэль отменена')
          .setDescription(`${opponent} не ответил на вызов вовремя. Дуэль отменена.`)
          .setColor('#6B1B1B')
          .setFooter({ text: 'Время вышло.', iconURL: 'https://cdn-icons-png.flaticon.com/512/3076/3076237.png' });

        message.channel.send({ embeds: [timeoutEmbed] }).then(msg => {
          setTimeout(() => msg.delete().catch(() => {}), 30000);
        });
      });
  });
}
else if (command === 'box') {
  const userId = message.author.id;

  if (message.channel.id !== COINS_CHANNEL_ID) {
    return message.delete().catch(() => {});
  }

  if (!data.coinsData[userId]) {
    data.coinsData[userId] = {
      coins: 0,
      promocode: null,
      usedPromocode: null,
      boxUsesToday: 0,
      boxLastUseDate: null,
    };
  }

  const userData = data.coinsData[userId];

  const today = new Date().toISOString().slice(0, 10);

  if (userData.boxLastUseDate !== today) {
    userData.boxUsesToday = 0;
    userData.boxLastUseDate = today;
  }

  const maxUsesPerDay = 200;
  const cost = 50;

  if (userData.boxUsesToday >= maxUsesPerDay) {
    const embedLimit = new EmbedBuilder()
      .setTitle('⛔ Лимит использований достигнут')
      .setDescription(`Вы уже использовали команду "бокс" **${maxUsesPerDay}** раз сегодня.\nПопробуйте завтра!`)
      .setColor('#FF4500')
      .setFooter({ text: '⏰ Сообщение удалится через 30 секунд', iconURL: 'https://cdn-icons-png.flaticon.com/512/137/137288.png' });

    const msg = await message.channel.send({ embeds: [embedLimit] });
    setTimeout(() => msg.delete().catch(() => {}), 30000);
    return message.delete().catch(() => {});
  }

  if (userData.coins < cost) {
    const embedNoCoins = new EmbedBuilder()
      .setTitle('❌ Недостаточно коинов')
      .setDescription(`Для открытия бокса нужно **${cost}** коинов.\nВаш баланс: **${userData.coins}** коинов.`)
      .setColor('#FF0000')
      .setFooter({ text: '⏰ Сообщение удалится через 30 секунд', iconURL: 'https://cdn-icons-png.flaticon.com/512/137/137288.png' });

    const msg = await message.channel.send({ embeds: [embedNoCoins] });
    setTimeout(() => msg.delete().catch(() => {}), 30000);
    return message.delete().catch(() => {});
  }

  userData.coins -= cost;

 const chance = Math.random();
let amount = 0;

if (chance < 0.65) {
  // 65% шанс: от 1 до 35 коинов
  amount = Math.floor(Math.random() * 35) + 1;
} else {
  // 35% шанс: от 36 до 200 коинов
  amount = Math.floor(Math.random() * (200 - 36 + 1)) + 36;
}

  userData.coins += amount;
  userData.boxUsesToday += 1;

  saveData();

  const embed = new EmbedBuilder()
    .setTitle('🎁 Бокс открыт!')
    .setDescription(`Поздравляем, <@${userId}>! Вам выпало **${amount}** коинов.`)
    .setColor('#FFD700')
    .setFooter({ text: 'Используйте команду снова, чтобы испытать удачу!', iconURL: 'https://cdn-icons-png.flaticon.com/512/137/137288.png' });

  const sentMsg = await message.channel.send({ embeds: [embed] });

  setTimeout(() => sentMsg.delete().catch(() => {}), 30000);

  await message.delete().catch(() => {});
}
if (command === 'hangman') {
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});
  await message.delete().catch(() => {});

  const entryFee = 200;
 const words = [
  // 🍎 Фрукты
  { word: 'арбуз', question: 'Фрукт с зелёной коркой и красной мякотью' },
  { word: 'банан', question: 'Жёлтый фрукт, любимый обезьянами' },
  { word: 'виноград', question: 'Ягоды, из которых делают вино' },
  { word: 'яблоко', question: 'Красный или зелёный фрукт, часто упоминается в сказках' },
  { word: 'груша', question: 'Фрукт с мягкой мякотью, часто зелёного или жёлтого цвета' },
  { word: 'апельсин', question: 'Цитрусовый фрукт с оранжевой кожурой' },
  { word: 'манго', question: 'Экзотический фрукт с жёлтой мякотью и крупной косточкой' },
  { word: 'лимон', question: 'Кислый жёлтый цитрус' },
  { word: 'ананас', question: 'Тропический фрукт с шершавой кожурой и хохолком' },

  // 🍖 Еда
  { word: 'пицца', question: 'Итальянское блюдо с тестом, соусом и сыром' },
  { word: 'борщ', question: 'Красный суп из свёклы' },
  { word: 'шашлык', question: 'Мясо на шампурах, приготовленное на углях' },
  { word: 'пельмени', question: 'Фарш в тесте, варят в воде' },
  { word: 'суши', question: 'Японское блюдо из риса и рыбы' },
  { word: 'картошка', question: 'Овощ, из которого делают пюре' },
  { word: 'котлета', question: 'Жареное мясное изделие круглой формы' },

  // 🌍 Природа
  { word: 'океан', question: 'Большой водоём, больше моря' },
  { word: 'гора', question: 'Высокая возвышенность на земле' },
  { word: 'лес', question: 'Место с большим количеством деревьев' },
  { word: 'пустыня', question: 'Сухая местность с песками и кактусами' },
  { word: 'река', question: 'Водный поток, текущий по земле' },
  { word: 'озеро', question: 'Небольшой водоём с пресной водой' },

  // 🐾 Животные
  { word: 'лев', question: 'Царь зверей' },
  { word: 'пингвин', question: 'Птица, которая не умеет летать, но отлично плавает' },
  { word: 'собака', question: 'Лучший друг человека' },
  { word: 'кошка', question: 'Животное, которое любит молоко и мурлычет' },
  { word: 'жираф', question: 'Животное с длинной шеей' },
  { word: 'слон', question: 'Крупное животное с хоботом' },
  { word: 'тигр', question: 'Полосатый хищник, родственник льва' },
  { word: 'медведь', question: 'Большой зверь, любящий мёд' },
  { word: 'заяц', question: 'Быстрое животное с длинными ушами' },

  // 🏙️ Города
  { word: 'москва', question: 'Столица России' },
  { word: 'париж', question: 'Город любви и Эйфелевой башни' },
  { word: 'ньюйорк', question: 'Город с небоскрёбами в США' },
  { word: 'лондон', question: 'Город с Биг-Беном' },
  { word: 'токио', question: 'Столица Японии' },
  { word: 'берлин', question: 'Столица Германии' },
  { word: 'рим', question: 'Город Колизея' },
  { word: 'мумбаи', question: 'Крупный город в Индии' },

  // 🎮 Игры
  { word: 'майнкрафт', question: 'Игра с кубиками, где можно строить миры' },
  { word: 'дота', question: 'Популярная MOBA-игра, сокращённо от Defense of the Ancients' },
  { word: 'ксго', question: 'Шутер от первого лица, где есть террористы и спецназ' },
  { word: 'форнайт', question: 'Королевская битва с танцами и строительством' },
  { word: 'гта', question: 'Игра про преступный мир, автомобили и открытый мир' },
  { word: 'старкрафт', question: 'Стратегия в космосе' },
  { word: 'варкрафт', question: 'Фэнтези стратегия от Blizzard' },

  // 📚 Литература
  { word: 'гаррипоттер', question: 'Мальчик со шрамом в виде молнии' },
  { word: 'войнаимир', question: 'Роман Льва Толстого' },
  { word: 'преступлениеинаказание', question: 'Роман Достоевского' },
  { word: 'евгенийонегин', question: 'Роман в стихах Пушкина' },
  { word: 'шерлокхолмс', question: 'Знаменитый детектив из книг Конан Дойля' },

  // 🌌 Космос
  { word: 'галактика', question: 'Скопление звёзд' },
  { word: 'звезда', question: 'Светило, которое светит на небе' },
  { word: 'комета', question: 'Космическое тело с хвостом' },
  { word: 'астероид', question: 'Космическое каменное тело' },
  { word: 'марс', question: 'Красная планета Солнечной системы' },
  { word: 'плутон', question: 'Карликовая планета Солнечной системы' },

  // 🛠️ Техника
  { word: 'телефон', question: 'Устройство, которым мы пользуемся каждый день' },
  { word: 'компьютер', question: 'Электронное устройство для работы и игр' },
  { word: 'робот', question: 'Машина, которая может выполнять команды человека' },
  { word: 'телевизор', question: 'Устройство для просмотра фильмов и программ' },
  { word: 'планшет', question: 'Устройство, больше телефона, но меньше ноутбука' },

  // 🚗 Транспорт
  { word: 'машина', question: 'Транспортное средство на четырёх колёсах' },
  { word: 'поезд', question: 'Длинное транспортное средство на рельсах' },
  { word: 'самолёт', question: 'Транспорт, который летает' },
  { word: 'корабль', question: 'Судно для плавания по воде' },
  { word: 'мотоцикл', question: 'Двухколёсный транспорт с мотором' },

  // ⚽ Спорт
  { word: 'футбол', question: 'Игра с мячом, где нужно забить гол' },
  { word: 'хоккей', question: 'Игра на льду с шайбой' },
  { word: 'бокс', question: 'Вид спорта, где два человека дерутся в перчатках' },
  { word: 'баскетбол', question: 'Игра, где мяч забрасывают в кольцо' },
  { word: 'шахматы', question: 'Игра с фигурами на клетчатой доске' },

  // 👔 Профессии
  { word: 'врач', question: 'Человек, который лечит людей' },
  { word: 'учитель', question: 'Человек, который обучает учеников' },
  { word: 'полицейский', question: 'Человек, который следит за порядком' },
  { word: 'пожарный', question: 'Человек, который тушит пожары' },
  { word: 'повар', question: 'Человек, который готовит еду' },
  { word: 'инженер', question: 'Специалист по проектированию и технике' },

  // 🌎 Страны
  { word: 'россия', question: 'Самая большая страна в мире' },
  { word: 'франция', question: 'Страна с Эйфелевой башней' },
  { word: 'германия', question: 'Страна с городом Берлин' },
  { word: 'япония', question: 'Страна восходящего солнца' },
  { word: 'индия', question: 'Страна с Тадж-Махалом' },

  // 🎬 Кино
  { word: 'титаник', question: 'Фильм про корабль и любовь Джэка и Розы' },
  { word: 'матрица', question: 'Фильм про виртуальную реальность и Нео' },
  { word: 'терминатор', question: 'Фильм с Арнольдом Шварценеггером' },

  // 🎵 Музыка
  { word: 'гитара', question: 'Музыкальный инструмент с шестью струнами' },
  { word: 'пианино', question: 'Клавишный музыкальный инструмент' },
  { word: 'скрипка', question: 'Музыкальный инструмент с смычком' },

  // 👗 Одежда
  { word: 'платье', question: 'Женская одежда для особых случаев' },
  { word: 'рубашка', question: 'Одежда с воротником и пуговицами' },
  { word: 'ботинки', question: 'Обувь для холодной погоды' },

  // 🥤 Напитки
  { word: 'чай', question: 'Горячий напиток из листьев' },
  { word: 'кофе', question: 'Напиток, который бодрит утром' },
  { word: 'лимонад', question: 'Освежающий газированный напиток' },

  // 🎉 Праздники
  { word: 'новыйгод', question: 'Праздник с ёлкой и Дедом Морозом' },
  { word: 'хэллоуин', question: 'Праздник с тыквами и костюмами' },
  { word: 'рождество', question: 'Праздник в декабре у христиан' },
// 🎬 Кино
  { word: 'титаник', question: 'Фильм про корабль и любовь Джэка и Розы' },
  { word: 'матрица', question: 'Фильм про виртуальную реальность и Нео' },
  { word: 'терминатор', question: 'Фильм с Арнольдом Шварценеггером' },
  { word: 'аватар', question: 'Фильм о планете Пандора и синих жителях' },
  { word: 'джокер', question: 'Фильм о враге Бэтмена' },
  { word: 'веном', question: 'Фильм про симбиота из Marvel' },

  // 🎵 Музыка
  { word: 'гитара', question: 'Музыкальный инструмент с шестью струнами' },
  { word: 'пианино', question: 'Клавишный музыкальный инструмент' },
  { word: 'скрипка', question: 'Музыкальный инструмент со смычком' },
  { word: 'барабаны', question: 'Ударный музыкальный инструмент' },
  { word: 'труба', question: 'Духовой инструмент' },

  // 👗 Одежда
  { word: 'платье', question: 'Женская одежда для особых случаев' },
  { word: 'рубашка', question: 'Одежда с воротником и пуговицами' },
  { word: 'ботинки', question: 'Обувь для холодной погоды' },
  { word: 'шапка', question: 'Головной убор для зимы' },
  { word: 'шарф', question: 'Аксессуар для защиты шеи от холода' },

  // 🥤 Напитки
  { word: 'чай', question: 'Горячий напиток из листьев' },
  { word: 'кофе', question: 'Напиток, который бодрит утром' },
  { word: 'лимонад', question: 'Освежающий газированный напиток' },
  { word: 'сок', question: 'Напиток из фруктов' },
  { word: 'молоко', question: 'Белый напиток от коровы' },

  // 🎉 Праздники
  { word: 'новыйгод', question: 'Праздник с ёлкой и Дедом Морозом' },
  { word: 'хэллоуин', question: 'Праздник с тыквами и костюмами' },
  { word: 'рождество', question: 'Праздник в декабре у христиан' },
  { word: 'пасха', question: 'Праздник с крашеными яйцами' },
  { word: 'деньрождения', question: 'Праздник в честь появления человека на свет' },

  // 🛋 Мебель
  { word: 'стол', question: 'Мебель для еды и работы' },
  { word: 'стул', question: 'Мебель для сидения' },
  { word: 'шкаф', question: 'Мебель для хранения одежды' },
  { word: 'диван', question: 'Мебель для отдыха, мягкая и длинная' },
  { word: 'кровать', question: 'Мебель для сна' },

  // 🌈 Цвета
  { word: 'красный', question: 'Цвет крови и спелой клубники' },
  { word: 'зелёный', question: 'Цвет травы' },
  { word: 'синий', question: 'Цвет неба в ясную погоду' },
  { word: 'жёлтый', question: 'Цвет солнца' },
  { word: 'чёрный', question: 'Цвет ночи' },

  // 🚘 Автомобили
  { word: 'мерседес', question: 'Немецкий бренд автомобилей' },
  { word: 'бмв', question: 'Популярный немецкий автопроизводитель' },
  { word: 'тойота', question: 'Японский бренд автомобилей' },
  { word: 'ауди', question: 'Немецкая марка машин с четырьмя кольцами' },
  { word: 'ламборгини', question: 'Итальянская марка суперкаров' },

  // 🔬 Наука
  { word: 'физика', question: 'Наука о движении, материи и энергии' },
  { word: 'химия', question: 'Наука о веществах и реакциях' },
  { word: 'биология', question: 'Наука о живых организмах' },
  { word: 'астрономия', question: 'Наука о космосе' },
  { word: 'математика', question: 'Наука о числах и формулах' },

  // ⚡ Мифология
  { word: 'зевс', question: 'Главный бог греческой мифологии' },
  { word: 'афродита', question: 'Богиня любви' },
  { word: 'геркулес', question: 'Герой с большой силой' },
  { word: 'посейдон', question: 'Бог моря' },
  { word: 'ады', question: 'Бог подземного мира' },

  // 💻 Интернет и IT
  { word: 'дискорд', question: 'Популярный мессенджер для геймеров' },
  { word: 'ютуб', question: 'Платформа для видео' },
  { word: 'гугл', question: 'Поисковая система' },
  { word: 'инстаграм', question: 'Соцсеть с фотографиями' },
  { word: 'тикток', question: 'Платформа для коротких видео' },
  // 🧬 Медицина
  { word: 'таблетка', question: 'Лекарственное средство в твёрдой форме' },
  { word: 'шприц', question: 'Инструмент для инъекций' },
  { word: 'маска', question: 'Средство защиты лица' },
  { word: 'бинт', question: 'Материал для перевязок' },
  { word: 'градусник', question: 'Прибор для измерения температуры тела' },

  // 🛒 Бытовые предметы
  { word: 'ложка', question: 'Столовый прибор для супа' },
  { word: 'вилка', question: 'Столовый прибор с зубцами' },
  { word: 'нож', question: 'Столовый прибор для резки' },
  { word: 'тарелка', question: 'Посуда для еды' },
  { word: 'кружка', question: 'Посуда для чая или кофе' },

  // 🌱 Растения
  { word: 'роза', question: 'Цветок с шипами' },
  { word: 'тюльпан', question: 'Весенний цветок разных цветов' },
  { word: 'берёза', question: 'Дерево с белой корой' },
  { word: 'дуб', question: 'Мощное дерево с желудями' },
  { word: 'подсолнух', question: 'Жёлтый цветок с семечками' },

  // 🦜 Животные (ещё)
  { word: 'воробей', question: 'Маленькая птичка, часто возле людей' },
  { word: 'орёл', question: 'Хищная птица с острым зрением' },
  { word: 'кабан', question: 'Дикий родственник свиньи' },
  { word: 'лисица', question: 'Рыжий хитрый зверь' },
  { word: 'пантера', question: 'Чёрный хищник из джунглей' },

  // 🚀 Техника и устройства
  { word: 'микроволновка', question: 'Устройство для разогрева еды' },
  { word: 'холодильник', question: 'Устройство для хранения продуктов' },
  { word: 'пылесос', question: 'Устройство для уборки пыли' },
  { word: 'плойка', question: 'Устройство для завивки волос' },
  { word: 'камерофон', question: 'Телефон с камерой' },

  // 🚖 Транспорт (добавка)
  { word: 'трамвай', question: 'Городской транспорт на рельсах' },
  { word: 'метро', question: 'Подземный транспорт' },
  { word: 'вертолёт', question: 'Летательный аппарат с винтами' },
  { word: 'скейтборд', question: 'Доска на колёсиках' },
  { word: 'самокат', question: 'Транспорт для детей и взрослых с рулём' },

  // 🌍 Страны (ещё)
  { word: 'бразилия', question: 'Страна с карнавалами и футболом' },
  { word: 'испания', question: 'Страна корриды и фламенко' },
  { word: 'италия', question: 'Страна пиццы и пасты' },
  { word: 'китай', question: 'Страна с Великой стеной' },
  { word: 'канада', question: 'Страна кленовых листьев' },

  // 🎶 Музыка (ещё)
  { word: 'барабан', question: 'Ударный инструмент' },
  { word: 'саксофон', question: 'Духовой инструмент из джаза' },
  { word: 'гармонь', question: 'Русский народный музыкальный инструмент' },
  { word: 'арфа', question: 'Инструмент с натянутыми струнами' },
  { word: 'флейта', question: 'Духовой инструмент без клапанов' },

  // 🎬 Фильмы (ещё)
  { word: 'гладиатор', question: 'Фильм с Максимусом' },
  { word: 'джуманджи', question: 'Фильм про игру, оживляющую животных' },
  { word: 'шрек', question: 'Мультфильм про зелёного огра' },
  { word: 'корольлев', question: 'Мультфильм про льва Симбу' },
  { word: 'холодноесердце', question: 'Мультфильм про Эльзу и Анну' },

  // 🏢 Бренды
  { word: 'найк', question: 'Бренд спортивной одежды с галочкой' },
  { word: 'адидас', question: 'Бренд с тремя полосками' },
  { word: 'пума', question: 'Бренд со зверем в логотипе' },
  { word: 'гугл', question: 'Компания с поисковой системой' },
  { word: 'аппл', question: 'Компания с логотипом в виде яблока' }
  
];

  const { word, question } = words[Math.floor(Math.random() * words.length)];
  let guessed = new Set();
  let tries = 6;
  const prize = word.length * 75;

  function getDisplayArray() {
    return [...word].map(l => ({ letter: l, guessed: guessed.has(l) }));
  }

  function roundRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function getRandomGlowColor() {
    const colors = ['#ffae00', '#ff6f61', '#6bc1ff', '#8aff9e', '#ff9aff', '#ffaa6b', '#66d9ff'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  async function generateHangmanImage() {
    const canvasWidth = 1100;
    const canvasHeight = 500;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    const glowColor = getRandomGlowColor();

    // Фон с красивым градиентом
    const bgGradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    bgGradient.addColorStop(0, '#0d1117');
    bgGradient.addColorStop(0.5, '#141a23');
    bgGradient.addColorStop(1, '#1e252f');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Шум
    const noiseCanvas = createCanvas(canvasWidth, canvasHeight);
    const noiseCtx = noiseCanvas.getContext('2d');
    const imageData = noiseCtx.createImageData(canvasWidth, canvasHeight);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 20;
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 18;
    }
    noiseCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(noiseCanvas, 0, 0);

    // Карточка с градиентной подложкой
    const cardX = 50;
    const cardY = 50;
    const cardWidth = canvasWidth - 100;
    const cardHeight = canvasHeight - 100;
    const cardRadius = 24;

    const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + cardHeight);
    cardGradient.addColorStop(0, '#2a2f38cc');
    cardGradient.addColorStop(1, '#1e2128cc');

    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 25;
    ctx.fillStyle = cardGradient;
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Обводка карточки (градиент)
    const borderGradient = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + cardHeight);
    borderGradient.addColorStop(0, `${glowColor}`);
    borderGradient.addColorStop(0.5, '#fff');
    borderGradient.addColorStop(1, `${glowColor}`);
    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 6;
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
    ctx.stroke();

    // Заголовок (градиент)
    ctx.font = 'bold 48px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleGradient = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
    titleGradient.addColorStop(0, glowColor);
    titleGradient.addColorStop(0.5, '#ffffff');
    titleGradient.addColorStop(1, glowColor);
    ctx.fillStyle = titleGradient;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 16;
    ctx.fillText('🎮 Виселица — Угадай слово', cardX + cardWidth / 2, cardY + 60);
    ctx.shadowBlur = 0;

    // Вопрос
    ctx.font = '600 26px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    const questionLabelGradient = ctx.createLinearGradient(cardX, cardY, cardX + 200, cardY);
    questionLabelGradient.addColorStop(0, glowColor);
    questionLabelGradient.addColorStop(1, '#fff');
    ctx.fillStyle = questionLabelGradient;
    ctx.fillText('❓ Вопрос:', cardX + 30, cardY + 130);

    ctx.font = '600 24px "Segoe UI", sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(question, cardX + 162, cardY + 131);

    // Слово (буквы с градиентом)
    const letters = getDisplayArray();
    const letterWidth = 48;
    const letterSpacing = 12;
    const totalWidth = letters.length * letterWidth + (letters.length - 1) * letterSpacing;
    const startX = cardX + cardWidth / 2 - totalWidth / 2;
    const y = cardY + 210;

    ctx.textBaseline = 'middle';
    ctx.font = 'bold 48px "Segoe UI", sans-serif';

    for (let i = 0; i < letters.length; i++) {
      const x = startX + i * (letterWidth + letterSpacing);
      if (letters[i].guessed) {
        const grad = ctx.createLinearGradient(x - 20, y - 24, x + 20, y + 24);
        grad.addColorStop(0, glowColor);
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, glowColor);
        ctx.fillStyle = grad;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 14;
        ctx.fillText(letters[i].letter.toUpperCase(), x, y);
      } else {
        const rectHeight = 60;
        const rectWidth = letterWidth;
        const rectY = y - rectHeight / 2;
        ctx.strokeStyle = `${glowColor}cc`;
        ctx.shadowBlur = 0;
        ctx.strokeRect(x - rectWidth / 2, rectY, rectWidth, rectHeight);
      }
    }
    ctx.shadowBlur = 0;

    // Осталось попыток (градиент)
    ctx.font = '600 28px "Segoe UI", sans-serif';
    const attemptsGradient = ctx.createLinearGradient(cardX, cardY + 280, cardX + 250, cardY + 280);
    attemptsGradient.addColorStop(0, glowColor);
    attemptsGradient.addColorStop(1, '#fff');
    ctx.fillStyle = attemptsGradient;
    ctx.fillText('❤️ Осталось попыток:', cardX + 30, cardY + 280);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(tries), cardX + 332, cardY + 280);

    // Вход и приз (градиент)
    ctx.font = '600 28px "Segoe UI", sans-serif';
    const infoGradient = ctx.createLinearGradient(cardX, cardY + 340, cardX + 250, cardY + 340);
    infoGradient.addColorStop(0, glowColor);
    infoGradient.addColorStop(1, '#fff');
    ctx.fillStyle = infoGradient;
    ctx.fillText('💰 Вход:', cardX + 30, cardY + 340);
    ctx.fillText('🏆 Приз:', cardX + 600, cardY + 340);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${entryFee} коинов`, cardX + 147, cardY + 340);
    ctx.fillText(`${prize} коинов`, cardX + 723, cardY + 340);

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'hangman.png' });
  }

  let attachment = await generateHangmanImage();
  const msg = await message.channel.send({ files: [attachment] });

  const filter = m =>
    !m.author.bot &&
    /^[а-яё]$/i.test(m.content) &&
    data.coinsData[m.author.id] &&
    data.coinsData[m.author.id].coins >= entryFee;

  const activePlayers = new Set();

  const collector = message.channel.createMessageCollector({ filter, time: 90000 });

  collector.on('collect', async m => {
    const userId = m.author.id;
    const letter = m.content.toLowerCase();

    await m.delete().catch(() => {});

    if (!activePlayers.has(userId)) {
      data.coinsData[userId].coins -= entryFee;
      activePlayers.add(userId);
      const joinMsg = await message.channel.send(`${m.author}, вы вступили в игру за **${entryFee}** коинов!`);
      setTimeout(() => joinMsg.delete().catch(() => {}), 10000);
    }

    if (guessed.has(letter)) {
      const guessedMsg = await message.channel.send(`${m.author}, буква **"${letter}"** уже была.`);
      setTimeout(() => guessedMsg.delete().catch(() => {}), 10000);
      return;
    }

    guessed.add(letter);

    if (!word.includes(letter)) {
      tries--;
      const noLetterMsg = await message.channel.send(`${m.author}, нет буквы **"${letter}"**. Осталось попыток: **${tries}**`);
      setTimeout(() => noLetterMsg.delete().catch(() => {}), 10000);
    }

    attachment = await generateHangmanImage();
    await msg.edit({ files: [attachment] });

    const currentDisplay = [...word].map(l => (guessed.has(l) ? l : '⚫')).join('');

    if (!currentDisplay.includes('⚫')) {
      data.coinsData[userId].coins += prize;
      const winEmbed = new EmbedBuilder()
        .setDescription(`🎉 **${m.author}** угадал(а) слово: **${word.toUpperCase()}** и получил(а) **${prize}** коинов!`)
        .setColor('#2ecc71');

      const winMsg = await message.channel.send({ embeds: [winEmbed] });
      setTimeout(() => winMsg.delete().catch(() => {}), 10000);

      saveData();
      collector.stop('won');
    }

    if (tries <= 0) {
      const failEmbed = new EmbedBuilder()
        .setDescription(`😞 Попытки закончились. К сожалению, слово не было отгадано.`)
        .setColor('#e74c3c');

      const failMsg = await message.channel.send({ embeds: [failEmbed] });
      setTimeout(() => failMsg.delete().catch(() => {}), 10000);

      collector.stop('fail');
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason !== 'won' && reason !== 'fail') {
      const timeoutEmbed = new EmbedBuilder()
        .setDescription(`⏰ Время вышло. К сожалению, слово не было отгадано.`)
        .setColor('#f1c40f');

      const timeoutMsg = await message.channel.send({ embeds: [timeoutEmbed] });
      setTimeout(() => timeoutMsg.delete().catch(() => {}), 10000);
    }
    msg.delete().catch(() => {});
  });
}
else if (command === 'anagram') {
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});
  await message.delete().catch(() => {});

  const entryFee = 150;
  const userId = message.author.id;

  if (!data.coinsData[userId] || data.coinsData[userId].coins < entryFee) {
    return message.channel.send({
      embeds: [createEmbed({
        title: '❌ Недостаточно коинов',
        description: `У вас недостаточно средств. Необходимо **${entryFee}** коинов для участия.`,
        color: '#e74c3c'
      })]
    }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
  }

  data.coinsData[userId].coins -= entryFee;
  saveData();

  const categories = {
IT: [
      "программист","алгоритм","сервер","массив","функция","бот","нейросеть","компьютер","код","гитхаб",
      "дебаг","байт","компиляция","интерфейс","класс","объект","метод","переменная","память","цикл",
      "база","данных","протокол","шаблон","тест","фреймворк","консоль","проект","репозиторий","скрипт",
      "сеть","хост","порт","браузер","кеш","модуль","пакет","алгоритм","индекс","конфигурация",
      "шлюз","сервер","домен","ключ","пароль","запрос","ответ","сессия","лог","анализ",
      "система","язык","приложение","инструмент","отладка","версия","библиотека","функция","данные","код",
      "протокол","архитектура","шаблон","параметр","поток","оператор","файл","сервер","пакет","платформа",
      "конструктор","синтаксис","отмена","домен","клиент","бэкенд","фронтенд","сервер","апи","интеграция"
    ],
    Животные: [
      "собака","кошка","дельфин","медведь","лиса","волк","слон","кенгуру","крокодил","ёж",
      "тигр","лев","жираф","заяц","барсук","панда","мышь","крыса","орёл","совa",
      "попугай","воробей","ласточка","бегемот","носорог","бурундук","лось","выдра","кабан","утка",
      "гусь","ворона","пингвин","страус","акула","рыба","краб","омар","осьминог","медуза",
      "крапивница","моллюск","зебра","обезьяна","попугай","сова","фламинго","колибри","еж","крот",
      "енот","крыса","крыса","бобр","лягушка","жаба","кобра","питон","ящерица","геккон",
      "скорпион","паук","муравей","бабочка","пчела","осa","жук","моль","комар","стрекоза"
    ],
    Еда: [
      "пицца","шоколад","картофель","морковь","арбуз","огурец","пельмени","омлет","борщ","пирог",
      "шашлык","йогурт","салат","суп","котлета","булочка","хлеб","сыр","молоко","кефир",
      "варенье","джем","конфета","торт","печенье","мороженое","кефир","вода","чай","кофе",
      "сок","лимонад","масло","мед","сахар","соль","перец","рис","макароны","гречка",
      "овсянка","курица","рыба","говядина","свинина","индейка","яйцо","томат","капуста","лук",
      "чеснок","перец","тыква","баклажан","кабачок","горох","фасоль","горчица","майонез","кетчуп",
      "горячее","холодное","десерт","закуска","напиток","хлебец","булка","блин","кекс","пудинг"
    ],
    Города: [
      "москва","париж","токио","лондон","петербург","берлин","мадрид","рим","пекин","киев",
      "минск","варшава","прага","стокгольм","копенгаген","оттава","вашингтон","торонто","мельбурн","сингапур",
      "бостон","чикаго","лосанджелес","каир","джакарта","бангкок","дели","мумбаи","шанхай","сеул",
      "стамбул","мюнхен","вена","будапешт","флоренция","неаполь","филадельфия","бостон","хельсинки","осло",
      "милан","познань","глазго","бари","валенсия","баск","либре","перт","кенсингтон","базель",
      "заандам","гент","левен","генуя","корк","лиссабон","салоники","тасмания","киото","нагоя"
    ],
    Природа: [
      "гора","озеро","лес","гром","туча","ветер","река","пруд","болото","пещера",
      "долина","равнина","пустыня","заповедник","поле","луга","болото","джунгли","океан","пляж",
      "пляж","водопад","гора","скала","камень","песок","глина","тундра","тайга","степь",
      "заросли","долина","поляна","роща","лес","болото","берег","мороз","снег","лед",
      "дождь","град","гроза","радуга","солнце","луна","звезда","небо","облако","туман",
      "ветер","буря","ураган","землетрясение","вулкан","водоворот","прилив","отлив","ледник","пещера"
    ],
     Космос: [
    "луна", "марс", "звезда", "телескоп", "ракета", "планета", "комета", "астероид", "галактика", "солнце",
    "орбита", "чернаядыра", "спутник", "млечныйпуть", "космонавт", "метеор", "космос", "атмосфера", "вакуум", "квазары",
    "звездопад", "созвездие", "метеорит", "астрономия", "экзопланета", "радиотелескоп", "космическийтелескоп", "пульсар", "нейтроннаязвезда", "белыйкарлик",
    "красныйгигант", "чернаядыра", "протозвезда", "протопланетныйдиск", "темнаяматерия", "темнаяэнергия", "исследование", "космодром", "луноход", "спутникземли",
    "астронавт", "космическийкорабль", "экспедиция", "телескоп", "космическаястанция", "орбитальнаястанция", "гравитация", "невесомость", "звезднаясистема", "метеозонд"
  ],
  Мифология: [
    "зевс", "тор", "пегас", "цербер", "один", "гера", "аполлон", "афина", "дионис", "гадес",
    "персей", "аргонавт", "геркулес", "афродита", "феникс", "минерва", "кронос", "ра", "осирис", "сет",
    "анубис", "богиня", "бог", "деметра", "плутон", "юпитер", "нептун", "марс", "венера", "меркурий",
    "локи", "фрейя", "балдр", "идунн", "хель", "мидгард", "йотун", "асгард", "валькирия", "рим",
    "гильгамеш", "медуза", "гарпия", "сфинкс", "цербер", "гидра", "миногей", "кукла", "келпи", "дриада"
  ],
  Спорт: [
    "футбол", "волейбол", "теннис", "лыжи", "гол", "баскетбол", "хоккей", "регби", "гандбол", "плавание",
    "бокс", "борьба", "фехтование", "карате", "дзюдо", "пауэрлифтинг", "шахматы", "биатлон", "скейтборд", "серфинг",
    "гонки", "триатлон", "прыжки", "лыжныегонки", "гольф", "велоспорт", "бег", "спринт", "марафон", "прыжокввысоту",
    "прыжоквдлину", "йога", "танцы", "фигурноекатание", "тхэквондо", "паркур", "скалолазание", "регби", "велотрек", "флорбол"
  ],
  Литература: [
    "поэт", "роман", "глава", "библиотека", "автор", "стихи", "проза", "сказка", "эпопея", "трагедия",
    "комедия", "повесть", "эссе", "драма", "фантастика", "миф", "легенда", "детектив", "романтика", "повесть",
    "герой", "сюжет", "диалог", "монолог", "персонаж", "книга", "рассказ", "фильм", "жанр", "писатель",
    "литература", "классика", "современность", "биография", "автобиография", "критика", "публицистика", "поэма", "сатира", "аллегория"
  ],
  Техника: [
    "пылесос", "телевизор", "компьютер", "наушники", "холодильник", "телефон", "микроволновка", "стиральнаямашина", "принтер", "факс",
    "роутер", "колонка", "проектор", "кабель", "адаптер", "монитор", "мышь", "клавиатура", "процессор", "жесткийдиск",
    "планшет", "смартфон", "камера", "навигация", "батарея", "зарядка", "вентилятор", "кондиционер", "миксер", "блендер",
    "утюг", "электрочайник", "плита", "духовка", "телескоп", "радио", "радиоприемник", "микрофон", "дрон", "лазер"
  ],
  История: [
  "император", "революция", "феодализм", "средневековье", "гладиатор", "колонизация", "монархия", "цивилизация", "война", "племя",
  "инквизиция", "деспот", "аристократ", "крестоносец", "ренессанс", "реформация", "царь", "крепость", "археология", "княжество"
],
Психология: [
  "инстинкт", "подсознание", "мотивация", "самооценка", "стресс", "эмпатия", "депрессия", "фобия", "характер", "психотип",
  "интроверт", "экстраверт", "мышление", "навык", "убеждение", "психика", "установка", "поведение", "реакция", "психолог"
]
  };
  const words = Object.values(categories).flat();
  const word = words[Math.floor(Math.random() * words.length)];

  const shuffle = (str) => str.split('').sort(() => Math.random() - 0.5).join('');
  const shuffled = shuffle(word);
  const prize = Math.floor(word.length * 150 * 2);

  const embedStart = createEmbed({
    title: '🔤 Анаграмма — Угадай слово!',
    description: [
      `🔀 Перемешанные буквы: \`${shuffled}\``,
      '',
      `💰 Взнос: **${entryFee}** коинов`,
      `🏆 Потенциальный выигрыш: **${prize}** коинов`,
      '',
      '⏳ У вас есть **20 секунд**, чтобы ввести правильное слово!'
    ].join('\n'),
    color: '#3498db'
  });

  await message.channel.send({ embeds: [embedStart] })
    .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));

  const filter = m => m.author.id === userId && m.content.toLowerCase() === word.toLowerCase();
  const collector = message.channel.createMessageCollector({ filter, max: 1, time: 20000 });

  collector.on('collect', async m => {
    data.coinsData[userId].coins += prize;
    saveData();

    const embedWin = createEmbed({
      title: '🎉 Победа!',
      description: `Поздравляем, **${m.author.username}**! Вы угадали слово **${word}** и выиграли **${prize}** коинов!`,
      color: '#2ecc71'
    });

    await message.channel.send({ embeds: [embedWin] })
      .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
  });

  collector.on('end', async collected => {
    if (collected.size === 0) {
      const embedLose = createEmbed({
        title: '😞 Время вышло!',
        description: `Вы не успели угадать. Правильный ответ был: **${word}**.`,
        color: '#e74c3c'
      });

      await message.channel.send({ embeds: [embedLose] })
        .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
    }
  });
}

else if (command === 'рулетка') {
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});
  
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, EmbedBuilder } = require('discord.js');
  const { createCanvas } = require('@napi-rs/canvas');

  const betRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bet_100').setLabel('💰 100').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bet_500').setLabel('💰 500').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bet_1000').setLabel('💰 1000').setStyle(ButtonStyle.Primary)
  );

  const sentMessage = await message.reply({ content: 'Выбери ставку:', components: [betRow] });

  const betFilter = i => i.user.id === message.author.id && i.customId.startsWith('bet_');
  const betCollector = sentMessage.createMessageComponentCollector({ filter: betFilter, time: 15000, max: 1 });

  betCollector.on('collect', async betInteraction => {
    const bet = parseInt(betInteraction.customId.split('_')[1]);

    const colorRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`color_red_${bet}`).setLabel('🔴 Красное').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`color_black_${bet}`).setLabel('⚫ Чёрное').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`color_green_${bet}`).setLabel('🟢 Зелёное').setStyle(ButtonStyle.Success)
    );

    await betInteraction.update({ content: `Ставка: **${bet}** коинов\nВыбери цвет:`, components: [colorRow] });

    const colorFilter = i => i.user.id === message.author.id && i.customId.startsWith('color_');
    const colorCollector = sentMessage.createMessageComponentCollector({ filter: colorFilter, time: 15000, max: 1 });

    colorCollector.on('collect', async colorInteraction => {
      const [ , chosenColor, betAmount ] = colorInteraction.customId.split('_');
      const resultColor = spinRoulette();

      const resultImage = await drawRouletteResult(chosenColor, resultColor, betAmount);

      let win = chosenColor === resultColor;

      const resultEmbed = new EmbedBuilder()
        .setTitle(win ? '🎉 Победа!' : '😢 Проигрыш!')
        .setDescription(`Выпало: **${formatColor(resultColor)}**\nТы выбрал: **${formatColor(chosenColor)}**\n${win ? `Выигрыш: **${calcWin(betAmount, resultColor)}** коинов` : `Потеря: **${betAmount}** коинов`}`)
        .setColor(win ? 0x00FF00 : 0xFF0000);

      const attachment = new AttachmentBuilder(resultImage, { name: 'roulette.png' });

      await colorInteraction.update({ content: '', components: [], embeds: [resultEmbed], files: [attachment] });
    });
  });

  function spinRoulette() {
    const roll = Math.floor(Math.random() * 37); // 0-36
    if (roll === 0) return 'green';
    return roll % 2 === 0 ? 'black' : 'red';
  }

  function calcWin(bet, color) {
    if (color === 'green') return bet * 14;
    return bet * 2;
  }

  function formatColor(color) {
    if (color === 'red') return '🔴 Красное';
    if (color === 'black') return '⚫ Чёрное';
    return '🟢 Зелёное';
  }

  async function drawRouletteResult(playerColor, resultColor, bet) {
    const canvas = createCanvas(500, 300);
    const ctx = canvas.getContext('2d');

    // Фон
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Текст
    ctx.font = 'bold 40px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🎰 Рулетка Казино', 90, 60);

    // Колесо
    ctx.beginPath();
    ctx.arc(250, 160, 80, 0, Math.PI * 2);
    ctx.fillStyle = resultColor === 'red' ? '#ff0000' : resultColor === 'black' ? '#000000' : '#00ff00';
    ctx.fill();

    // Указатель
    ctx.beginPath();
    ctx.moveTo(250, 50);
    ctx.lineTo(240, 90);
    ctx.lineTo(260, 90);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Информация о ставке
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Твоя ставка: ${bet} коинов`, 140, 260);
    ctx.fillText(`Ты выбрал: ${formatColor(playerColor)}`, 140, 290);

    return canvas.encode('png');
  }
}


// ===============================
// 💰 БЛОК 7: ПОМОЩЬ
// ===============================
else if (command === 'help') {
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});

  const isMod = message.member.roles.cache.has(MOD_ROLE_ID) || message.member.roles.cache.has(MAIN_MOD_ROLE_ID);

  const allCommands = [
    // Обычные
    { category: 'Обычные', name: '/info', desc: 'Показать информацию о пользователе', usage: '/info' },
    { category: 'Обычные', name: '/deposit', desc: 'Пополнить депозит', usage: '/deposit 1000' },
    { category: 'Обычные', name: '/withdraw', desc: 'Снять коины с депозита', usage: '/withdraw 500' },
    { category: 'Обычные', name: '/pay', desc: 'Перевести коины другому пользователю', usage: '/pay @user 200' },
    { category: 'Обычные', name: '/createpromo', desc: 'Создать промокод за 5000 коинов', usage: '/createpromo MYCODE' },
    { category: 'Обычные', name: '/promo', desc: 'Использовать чужой промокод', usage: '/promo CODE' },
    { category: 'Обычные', name: '/extendrole', desc: 'Продлить приватную роль', usage: '/extendrole' },
    { category: 'Обычные', name: '/checkroles', desc: 'Проверить свои приватные роли', usage: '/checkroles' },
    { category: 'Обычные', name: '/top', desc: 'Посмотреть список топа по эконочике', usage: '/top' },

    // Игровые
    { category: 'Игровые', name: '/numbers', desc: 'Мини-игра "Угадай число"', usage: '/numbers' },
    { category: 'Игровые', name: '/duel', desc: 'Дуэль со ставкой коинов', usage: '/duel @user 300' },
    { category: 'Игровые', name: '/box', desc: 'Открыть бокс за 50 коинов', usage: '/box' },
    { category: 'Игровые', name: '/hangman', desc: 'Угадай слово по буквам', usage: '/hangman' },
    { category: 'Игровые', name: '/anagram', desc: 'Анаграмма - угадай слово', usage: '/anagram' },

    // Семейные
    { category: 'Семейные', name: '/extend_fam', desc: 'Продлить срок действия семьи', usage: '/extend_fam' },
    { category: 'Семейные', name: '/fam_info', desc: 'Показать информацию о своей семье', usage: '/fam_info' },
    { category: 'Семейные', name: '/a_fam', desc: 'Добавить участника в свою семью', usage: '/a_fam @пользователь' },
    { category: 'Семейные', name: '/d_fam', desc: 'Удалить участника из своей семьи', usage: '/d_fam @пользователь' },
    { category: 'Семейные', name: '/a_zam', desc: 'Назначить/снять заместителя семьи', usage: '/a_zam @пользователь 1/2/3' },
    { category: 'Семейные', name: '/d_zam', desc: 'Снять заместителя семьи', usage: '/d_zam @пользователь' },
    { category: 'Семейные', name: '/transfer_fam', desc: 'Передать семью другому участнику', usage: '/transfer_fam @пользователь <цена>' },
    { category: 'Семейные', name: '/fam_bank', desc: 'Пополнить банк семьи для её продления', usage: '/fam_bank количество коинов' },
    { category: 'Семейные', name: '/fam_psj', desc: 'Покинуть семью самостоятельно', usage: '/fam_psj' },

    // Модераторские
    { category: 'Модераторские', name: '/promocodes', desc: 'Список всех промокодов', usage: '/promocodes', mod: true },
    { category: 'Модераторские', name: '/delpromo', desc: 'Удалить промокод', usage: '/delpromo CODE причина', mod: true },
    { category: 'Модераторские', name: '/createrole', desc: 'Создать приватную роль', usage: '/createrole @user1 #FFAA00 10000', mod: true },
    { category: 'Модераторские', name: '/give_coins', desc: 'Выдать коины пользователю', usage: '/give_coins @user 500 причина', mod: true },
    { category: 'Модераторские', name: '/take_coins', desc: 'Снять коины у пользователя', usage: '/take_coins @user 500 причина', mod: true },
    { category: 'Модераторские', name: '/give_bonus_role', desc: 'Запустить автоначисление бонусов', usage: '/give_bonus_role @роль 5', mod: true },
    { category: 'Модераторские', name: '/remove_bonus_role', desc: 'Остановить бонусную роль', usage: '/remove_bonus_role @роль', mod: true },
    { category: 'Модераторские', name: '/list_bonus_roles', desc: 'Список бонусных ролей', usage: '/list_bonus_roles', mod: true },
    { category: 'Модераторские', name: '/togglecoins', desc: 'Включить/отключить коины в канале', usage: '/togglecoins #канал', mod: true },
    { category: 'Модераторские', name: '/listdisabledchannels', desc: 'Каналы без начисления коинов', usage: '/listdisabledchannels', mod: true },
    { category: 'Модераторские', name: '/create_fam', desc: 'Создать новую семью', usage: '/create_fam', mod: true },
    { category: 'Модераторские', name: '/delete_fam', desc: 'Удалить семью по роли', usage: '/delete_fam @роль причина', mod: true },
    { category: 'Модераторские', name: '/del_role', desc: 'Удалить приватную роль позователя', usage: '/del_role', mod: true },

    
  ];

  const filteredCommands = allCommands.filter(cmd => !(cmd.mod && !isMod));

  const categories = [...new Set(filteredCommands.map(cmd => cmd.category))];
  const commandsByCategory = {};
  for (const category of categories) {
    commandsByCategory[category] = filteredCommands.filter(c => c.category === category);
  }


  const categoryColors = {
    'Обычные': '#7945ced0',
    'Игровые': '#e67d22d3',
    'Семейные': '#9c59b6b4',
    'Модераторские': '#8bc34aa4',
  };

 
  const width = 1500;
  const padding = 50;
  const lineHeight = 38;
  const headerHeight = 90;
  const footerHeight = 50;

  function drawRoundedRect(ctx, x, y, w, h, r, color, strokeWidth = 3) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = '#1e1e1e';
    ctx.fill();
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function createPageBuffer(categoryIndex) {
    const category = categories[categoryIndex];
    const cmds = commandsByCategory[category];
    const color = categoryColors[category] || '#fff';

    const cmdHeight = 60; 
    const gap = 15;      
    const height = headerHeight + cmds.length * (cmdHeight + gap) + footerHeight;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

   
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0d1b2a');   // Очень тёмно-синий сверху
    gradient.addColorStop(1, '#000000');   // Чёрный внизу
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

  
    drawRoundedRect(ctx, 15, 15, width - 30, height - 30, 20, color, 5);

  
    ctx.font = 'bold 42px Sans';
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillText(`📚 ${category} команды`, padding, 30);
    ctx.shadowBlur = 0;

  
    let y = headerHeight;

    for (let i = 0; i < cmds.length; i++) {
      const cmd = cmds[i];
      const num = i + 1;

      const boxX = padding;
      const boxY = y;
      const boxW = width - padding * 2;
      const boxH = cmdHeight;

    
      ctx.fillStyle = '#222222';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(boxX + 15, boxY);
      ctx.lineTo(boxX + boxW - 15, boxY);
      ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + 15);
      ctx.lineTo(boxX + boxW, boxY + boxH - 15);
      ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - 15, boxY + boxH);
      ctx.lineTo(boxX + 15, boxY + boxH);
      ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - 15);
      ctx.lineTo(boxX, boxY + 15);
      ctx.quadraticCurveTo(boxX, boxY, boxX + 15, boxY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

     
      ctx.fillStyle = color;
      ctx.font = 'bold 28px Sans';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(`${num}.`, boxX + 15, boxY + boxH / 2);


      const numberWidth = ctx.measureText(`${num}.`).width;
      const baseIndent = 15;
      const gapAfterNumber = 20;

      const nameDescX = boxX + baseIndent + numberWidth + gapAfterNumber;

   
      ctx.fillStyle = '#eee';
      ctx.font = '22px "Courier New", Courier, monospace';
      ctx.fillText(`${cmd.name} — ${cmd.desc}`, nameDescX, boxY + boxH / 2);

    
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'right';
      ctx.fillText(cmd.usage, boxX + boxW - 20, boxY + boxH / 2);

      y += boxH + gap;
    }


    ctx.font = '16px Sans';
    ctx.fillStyle = '#777';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Всего команд: ${cmds.length} | Страница ${categoryIndex + 1} из ${categories.length} | Запросил: ${message.author.tag}`,
      padding,
      height - 30
    );

  
    ctx.textAlign = 'right';
    ctx.fillText(moment().format('HH:mm'), width - padding, height - 30);

    return canvas.toBuffer();
  }

  let page = 0;
  let buffer = createPageBuffer(page);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('help_prev')
      .setLabel('Назад')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('help_next')
      .setLabel('Вперёд')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === categories.length - 1),
    new ButtonBuilder()
      .setCustomId('help_close')
      .setLabel('Закрыть')
      .setStyle(ButtonStyle.Danger),
  );

  const sentMsg = await message.channel.send({
    files: [{ attachment: buffer, name: 'help_commands.png' }],
    components: [row],
  });
  await message.delete().catch(() => {});

  const collector = sentMsg.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id,
    time: 60000,
  });

  collector.on('collect', async (interaction) => {
    if (interaction.customId === 'help_prev' && page > 0) {
      page--;
    } else if (interaction.customId === 'help_next' && page < categories.length - 1) {
      page++;
    } else if (interaction.customId === 'help_close') {
      await sentMsg.delete().catch(() => {});
      collector.stop();
      return;
    }
    buffer = createPageBuffer(page);
    await interaction.update({
      files: [{ attachment: buffer, name: 'help_commands.png' }],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('help_prev')
            .setLabel('Назад')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('help_next')
            .setLabel('Вперёд')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === categories.length - 1),
          new ButtonBuilder()
            .setCustomId('help_close')
            .setLabel('Закрыть')
            .setStyle(ButtonStyle.Danger),
        )
      ],
    });
  });

  collector.on('end', async () => {
    if (!sentMsg.deleted) {
      await sentMsg.edit({ components: [] }).catch(() => {});
      setTimeout(() => sentMsg.delete().catch(() => {}), 15000);
    }
  });
}
else if (command === 'top') {
  if (message.channel.id !== COINS_CHANNEL_ID) return message.delete().catch(() => {});
  await message.delete().catch(() => {});

async function generateTopImage(sortBy = 'coins') {
  const sortedUsers = Object.entries(data.coinsData).sort(([, a], [, b]) => {
    if (sortBy === 'coins') return (b.coins || 0) - (a.coins || 0);
    if (sortBy === 'deposit') return (b.deposit || 0) - (a.deposit || 0);
    return 0;
  });

  let topUsers = sortedUsers;

  if (sortBy === 'name') {
    const withNames = await Promise.all(
      sortedUsers.map(async ([userId, userData]) => {
        const member = await message.guild.members.fetch(userId).catch(() => null);
        return { userId, userData, name: member?.displayName || 'Неизвестный' };
      })
    );
    withNames.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    topUsers = withNames.map(({ userId, userData }) => [userId, userData]);
  }

  topUsers = topUsers.slice(0, 5);

  const canvasWidth = 1650;
  const rowHeight = 65;
  const headerHeight = 100;
  const tableHeaderHeight = 80;
  const footerHeight = 50;
  const sidePadding = 80;
  const canvasHeight = headerHeight + tableHeaderHeight + topUsers.length * rowHeight + footerHeight;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, '#1e2125');
  gradient.addColorStop(1, '#2e3238');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const titleText = '📋 Топ пользователей по экономике SUN-CITY';
  ctx.font = 'bold 42px Sans';
  const textWidth = ctx.measureText(titleText).width;
  const grad = ctx.createLinearGradient(sidePadding, 0, sidePadding + textWidth, 0);
  grad.addColorStop(0, '#e3c55a');
  grad.addColorStop(1, '#c2912a');

  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(255, 200, 0, 0.4)';
  ctx.shadowBlur = 12;
  ctx.fillText(titleText, sidePadding, 60);
  ctx.shadowColor = 'transparent';

  const sepGradient = ctx.createLinearGradient(0, 70, 0, 76);
  sepGradient.addColorStop(0, '#ffd70033');
  sepGradient.addColorStop(0.5, '#ffaa0033');
  sepGradient.addColorStop(1, '#ffd70033');

  ctx.fillStyle = sepGradient;
  ctx.fillRect(sidePadding, 70, canvasWidth - sidePadding * 2, 6);

  const columns = [
    { title: '№', x: sidePadding + 20, align: 'left' },
    { title: 'Имя пользователя', x: sidePadding + 120, align: 'left' },
    { title: 'Баланс', x: sidePadding + 810, align: 'right' },
    { title: 'Депозит', x: sidePadding + 1020, align: 'right' },
    { title: 'Статус', x: sidePadding + 1210, align: 'left' }
  ];

  ctx.font = 'bold 26px Sans';
  ctx.fillStyle = '#dddddd';
  for (const col of columns) {
    ctx.textAlign = col.align;
    ctx.fillText(col.title, col.x, headerHeight + 10);
  }

  let y = headerHeight + tableHeaderHeight;
  ctx.font = '22px Sans';

  for (let i = 0; i < topUsers.length; i++) {
    const [userId, userData] = topUsers[i];
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const displayName = member?.displayName || 'Неизвестный';
    const coins = userData.coins || 0;
    const deposit = userData.deposit || 0;
    const status = getStatus(coins);

    const highlightTop = i < 5;
    if (highlightTop) {
      const rectColor = i === 0
        ? 'rgba(255, 223, 100, 0.15)'
        : i === 1
        ? 'rgba(173, 216, 230, 0.1)'
        : i === 2
        ? 'rgba(216, 191, 216, 0.1)'
        : 'rgba(255, 255, 255, 0.06)';

      const strokeColor = i === 0
        ? 'rgba(255, 223, 100, 0.5)'
        : i === 1
        ? 'rgba(135, 206, 235, 0.5)'
        : i === 2
        ? 'rgba(221, 160, 221, 0.5)'
        : 'rgba(255, 255, 255, 0.2)';

      ctx.fillStyle = rectColor;
      roundRect(ctx, sidePadding - 10, y - 42, canvasWidth - sidePadding * 2 + 20, rowHeight - 10, 12, true, false);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      roundRect(ctx, sidePadding - 10, y - 42, canvasWidth - sidePadding * 2 + 20, rowHeight - 10, 12, false, true);
    }

    const numberX = sidePadding + 20;
    if (i === 0 || i === 1 || i === 2) {
      const colors = i === 0
        ? ['#fff9c4', '#ffd54f']
        : i === 1
        ? ['#add8e6', '#87ceeb']
        : ['#e6ccff', '#d19fe8'];

      drawGradientText(`${i + 1}`, numberX, y, 'left', colors);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}`, numberX, y);
    }

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(displayName.length > 30 ? displayName.slice(0, 30) + '…' : displayName, sidePadding + 120, y);

    ctx.fillStyle = '#bbbbbb';
    ctx.textAlign = 'right';
    ctx.fillText(coins.toLocaleString('ru-RU'), sidePadding + 810, y);
    ctx.fillText(deposit.toLocaleString('ru-RU'), sidePadding + 1020, y);

    ctx.textAlign = 'left';
    ctx.fillText(status, sidePadding + 1210, y);

    y += rowHeight;
  }

  ctx.fillStyle = '#888';
  ctx.font = '16px Sans';
  ctx.textAlign = 'left';
  const formattedTime = new Date().toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  ctx.fillText(`Всего пользователей: ${topUsers.length} • Сформировано: ${formattedTime}`, sidePadding, canvasHeight - 20);

  return canvas.toBuffer();

  function drawGradientText(text, x, y, align = 'left', colors = ['#ffdb6a', '#d49a00']) {
    ctx.textAlign = align;
    const grad = ctx.createLinearGradient(x, y - 20, x, y + 10);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 5;
    ctx.fillText(text, x, y);
    ctx.shadowColor = 'transparent';
  }
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  } else {
    for (let side of ['tl', 'tr', 'br', 'bl']) {
      radius[side] = radius[side] || 0;
    }
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}





  const buffer = await generateTopImage('coins');

 
  const buttonsRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('sort_coins')
        .setLabel('Коины')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('sort_deposit')
        .setLabel('Депозит')
        .setStyle(ButtonStyle.Success),

    );

  const sentMsg = await message.channel.send({
    files: [{ attachment: buffer, name: 'top.png' }],
    components: [buttonsRow]
  });


  const collector = sentMsg.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id,
    time: 60000
  });

  collector.on('collect', async interaction => {
    let sortBy;
    if (interaction.customId === 'sort_coins') sortBy = 'coins';
    else if (interaction.customId === 'sort_deposit') sortBy = 'deposit';
    else if (interaction.customId === 'sort_name') sortBy = 'name';

    if (!sortBy) return;

    await interaction.deferUpdate();

    const newBuffer = await generateTopImage(sortBy);
    await interaction.editReply({ files: [{ attachment: newBuffer, name: 'top.png' }] });
  });

  collector.on('end', () => {
    const disabledRow = new ActionRowBuilder()
      .addComponents(
        buttonsRow.components.map(btn => btn.setDisabled(true))
      );
    sentMsg.edit({ components: [disabledRow] }).catch(() => {});
    setTimeout(() => {
  sentMsg.delete().catch(() => {});
}, 10000); // Удаление через 45 секунд
  });
}
});
client.login('MTIyOTAyMDY3NjI0NjA4MTU2Ng.GNzId4.aQMynr7_AKKFT-_h7hi061zLB2TN22LKtdawSc');

