require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    ActivityType,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder 
} = require('discord.js');
const token = process.env.DISCORD_TOKEN
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');

// 1. เชื่อมต่อ Supabase
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_ANON_KEY
);

// 2. ตั้งค่าบอท Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ==========================================
// 🛑 ตั้งค่าตัวแปร ID ต่างๆ ของเซิร์ฟเวอร์
// ==========================================
const ALLOWED_ADMINS = ['599591612452044800', '298440870087098369']; 
const PING_EVENT_ROLE_ID = '1510306186761736403'; 
const PING_ADMIN_ROLE_ID = '1514948014941278290'; 
const DEITY_THREAD_ID = '1514953622654418954';
const DAILY_ANNOUNCEMENT_CHANNEL_ID = '1510927750872043520';
const DAILY_WEATHER_CHANNEL_ID = '1510927750872043520';

// 3. เตรียมข้อมูลโครงสร้าง Slash Commands
const commands = [
    {
        name: 'createprofile',
        description: 'สร้างโปรไฟล์ตัวละครใหม่ของคุณ',
        options: [{ 
            name: 'status', description: 'สถานะของตัวละคร (บังคับเลือก)', type: 3, required: true,
            choices: [{ name: 'พนักงานร้าน', value: 'พนักงานร้าน' }, { name: 'คนธรรมดา', value: 'คนธรรมดา' }, { name: 'วิญญาณ', value: 'วิญญาณ' }]
        }]
    },
    {
        name: 'setdeity',
        description: 'ตั้งค่าเทพประจำตัวให้กับตัวละคร (เฉพาะพนักงานร้านเท่านั้น)',
        options: [
            { name: 'character_name', description: 'ชื่อภาษาไทยของตัวละคร (ค้นหาได้เฉพาะพนักงานร้าน)', type: 3, required: true, autocomplete: true },
            { name: 'deity_id', description: 'ID ของเทพ (ตัวเลข)', type: 4, required: true }
        ]
    },
    { name: 'deities', description: 'ดูรายชื่อและ ID ของเทพทั้งหมดที่มีในระบบ' },
    {
        name: 'profile',
        description: 'ดูโปรไฟล์ข้อมูลตัวละคร',
        options: [{ name: 'character_name', description: 'ชื่อภาษาไทยของตัวละคร (ถ้าไม่ใส่จะแสดงตัวละครของคุณ)', type: 3, required: false, autocomplete: true }]
    },
    {
        name: 'editprofile',
        description: 'แก้ไขข้อมูลโปรไฟล์ตัวละครของคุณ (เลือกกรอกเฉพาะช่องที่ต้องการแก้)',
        options: [
            { name: 'character_name', description: 'ชื่อภาษาไทยของตัวละครที่คุณเป็นเจ้าของ', type: 3, required: true, autocomplete: true },
            { name: 'status', description: 'สถานะ of ตัวละคร', type: 3, required: false, choices: [{ name: 'พนักงานร้าน', value: 'พนักงานร้าน' }, { name: 'คนธรรมดา', value: 'คนธรรมดา' }, { name: 'วิญญาณ', value: 'วิญญาณ' }] },
            { name: 'age', description: 'อายุ (เช่น 20 ปี)', type: 3, required: false },
            { name: 'height', description: 'ส่วนสูง (เช่น 175 ซม.)', type: 3, required: false },
            { name: 'weight', description: 'น้ำหนัก (เช่น 60 กก.)', type: 3, required: false },
            { name: 'likes', description: 'สิ่งที่ชอบ (คั่นด้วยลูกน้ำ , หากมีหลายอย่าง)', type: 3, required: false },
            { name: 'dislikes', description: 'สิ่งที่ไม่ชอบ (คั่นด้วยลูกน้ำ , หากมีหลายอย่าง)', type: 3, required: false },
            { name: 'medium', description: 'สื่อกลางที่ใช้', type: 3, required: false },
            { name: 'image_url', description: 'ลิงก์รูปภาพประจำตัว (.png / .jpg)', type: 3, required: false },
            { name: 'banner_url', description: 'ลิงก์รูปภาพแนวนอนท้ายโปรไฟล์ (.png / .jpg)', type: 3, required: false },
            { name: 'theme_color', description: 'สีตกแต่ง (Hex Code เช่น #ff0000)', type: 3, required: false }
        ]
    },
    {
        name: 'dropshards',
        description: 'หาเสี้ยววิญญาณบริสุทธิ์ (จำนวนขึ้นอยู่กับเรทของเทพประจำตัว)',
        options: [{ name: 'character_name', description: 'ชื่อภาษาไทยของตัวละครที่คุณเป็นเจ้าของ', type: 3, required: true, autocomplete: true }]
    },
    {
        name: 'addshards',
        description: '[แอดมิน] เพิ่มหรือลดเสี้ยววิญญาณบริสุทธิ์ให้ตัวละคร',
        default_member_permissions: '8',
        options: [
            { name: 'character_name', description: 'ชื่อภาษาไทยของตัวละคร (ค้นหาได้ทุกคน)', type: 3, required: true, autocomplete: true },
            { name: 'amount', description: 'จำนวนที่จะเพิ่ม (หากต้องการลดให้ใส่ค่าติดลบ)', type: 4, required: true }
        ]
    },
    {
        name: 'joika',
        description: 'ทำพิธีปัดเป่าวิญญาณ (โจอิกะ) โดยใช้เสี้ยววิญญาณบริสุทธิ์ (เฉพาะพนักงานร้าน)',
        options: [
            { name: 'character_name', description: 'ชื่อตัวละครพนักงานร้านที่คุณเป็นเจ้าของ', type: 3, required: true, autocomplete: true },
            { name: 'level', description: 'เลือกระดับขั้นของพิธีปัดเป่าวิญญาณ', type: 3, required: true, choices: [{ name: 'ระดับที่ 1 - คงเท็น ไคชิกิ', value: 'konten' }, { name: 'ระดับที่ 2 - มาโตเอะ เรย์โซ', value: 'matoe' }, { name: 'ระดับที่ 3 - ชินอิ เค็นเก็น', value: 'shini' }] }
        ]
    },
    {
        name: 'offering',
        description: 'ถวายเสี้ยววิญญาณบริสุทธิ์ให้กับเทพประจำตัว (เฉพาะพนักงานร้าน)',
        options: [
            { name: 'character_name', description: 'ชื่อตัวละครพนักงานร้านที่คุณเป็นเจ้าของ', type: 3, required: true, autocomplete: true },
            { name: 'amount', description: 'จำนวนเสี้ยววิญญาณที่จะถวาย', type: 4, required: true }
        ]
    },
    {
        name: 'spawnghost',
        description: '[เฉพาะผู้ดูแล] ประกาศเหตุการณ์พบวิญญาณเร่ร่อน',
        default_member_permissions: '20' 
    },
    {
        name: 'transfer',
        description: 'ส่งเสี้ยววิญญาณบริสุทธิ์ให้กับพนักงานร้านคนอื่น',
        options: [
            { name: 'sender', description: 'ชื่อตัวละครของคุณ (ผู้ส่ง)', type: 3, required: true, autocomplete: true },
            { name: 'receiver', description: 'ชื่อตัวละครผู้รับ (พนักงานร้านในระบบ)', type: 3, required: true, autocomplete: true },
            { name: 'amount', description: 'จำนวนเสี้ยววิญญาณที่จะส่ง', type: 4, required: true }
        ]
    },
    {
        name: 'pray',
        description: 'ส่งข้อความถึงเทพประจำตัว (ใช้ครั้งละ 5 เสี้ยววิญญาณบริสุทธิ์)',
        options: [
            { name: 'character_name', description: 'ชื่อตัวละครพนักงานร้านของคุณ', type: 3, required: true, autocomplete: true },
            { name: 'message', description: 'ข้อความคำอธิษฐาน', type: 3, required: true }
        ]
    },
    {
        name: 'deitymessage',
        description: '[เฉพาะผู้ดูแล] เทพส่งสารหาพนักงานร้าน (หักเสี้ยววิญญาณตามระบุ)',
        default_member_permissions: '20',
        options: [
            { name: 'character_name', description: 'ชื่อตัวละครพนักงานร้านที่รับสาร', type: 3, required: true, autocomplete: true },
            { name: 'cost', description: 'จำนวนเสี้ยววิญญาณที่จะหักจากตัวละครผู้รับ', type: 4, required: true },
            { name: 'message', description: 'ข้อความจากเทพ', type: 3, required: true }
        ]
    },
    {
        name: 'whisper',
        description: '[เฉพาะผู้ดูแล] ส่งเสียงกระซิบปริศนาถึงตัวละคร (ไม่ระบุนามเทพ)',
        default_member_permissions: '20',
        options: [
            { name: 'character_name', description: 'ชื่อตัวละครที่จะรับเสียงกระซิบ', type: 3, required: true, autocomplete: true },
            { name: 'cost', description: 'จำนวนเสี้ยววิญญาณที่หัก (ใส่ 0 ได้หากต้องการให้ฟรี)', type: 4, required: true },
            { name: 'message', description: 'ข้อความเสียงกระซิบ', type: 3, required: true }
        ]
    }
];

// เมื่อบอทพร้อมทำงาน
client.once('ready', async () => {
    console.log(`✅ บอทออนไลน์แล้วในชื่อ ${client.user.tag}`);
    client.user.setActivity('Custom Status', { type: ActivityType.Custom, state: '👻 แบร่ๆๆๆๆๆ บรึ๋ยๆๆๆ' });

    try {
        console.log('⏳ กำลังลงทะเบียน Slash Commands...');
        await client.application.commands.set(commands);
        console.log('✅ ลงทะเบียนคำสั่งสำเร็จ!');
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการลงทะเบียนคำสั่ง:', error);
    }

    // 🌟 3. ระบบนาฬิกาปลุกส่งข้อความอัตโนมัติ
    // รหัส '0 20 * * *' หมายถึง: นาทีที่ 0, ชั่วโมงที่ 20 (สองทุ่ม), ของทุกวัน ทุกเดือน ทุกปี
    cron.schedule('0 20 * * *', async () => {
        try {
            // ดึงข้อมูลช่องแชทจาก ID ที่ตั้งไว้
            const channel = await client.channels.fetch(DAILY_ANNOUNCEMENT_CHANNEL_ID);
            
            if (channel) {
                // ข้อความพร้อม Formatting แบบ Discord
                const dailyMessage = `# โคมไฟหน้าร้านถูกจุดขึ้นแล้ว <a:1911pixelbluefire:1514997641623375984>\n-# คนปกติจะมองไม่เห็นร้านหนังสืออย่างน่าประหลาด หรือหากมองเห็นก็จะมีเหตุให้ต้องไปที่อื่นเสียก่อน แต่เหล่าดวงวิญญาณจะถูกดึงดูดมาตามแสงไฟจากโคม (ยกเว้นเหล่าคนที่มีพลังวิญญาณผิดจากคนทั่วไป พวกเขาจะถูกดึงดูดด้วยเหตุผลบางประการ)`;
                
                await channel.send(dailyMessage);
            }
        } catch (error) {
            console.error('[Daily Cron Error]', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Bangkok" // บังคับใช้เวลาประเทศไทย
    });
    
    console.log('✅ ระบบแจ้งเตือนรายวัน (20:00 น.) เริ่มทำงานแล้ว!');

    // ==========================================
    // 🌟 ระบบสุ่มสภาพอากาศอัตโนมัติเวลา 07:00 น. (ระบบเปอร์เซ็นต์ + อุณหภูมิ)
    // ==========================================
    cron.schedule('0 7 * * *', async () => {
        try {
            const weatherChannel = await client.channels.fetch(DAILY_WEATHER_CHANNEL_ID);
            
            if (weatherChannel) {
                const { data: weathers, error } = await supabase.from('weathers').select('*');
                if (error || !weathers || weathers.length === 0) return console.error('[Weather DB Error]', error);

                // 1. ระบบคำนวณและสุ่มตามเปอร์เซ็นต์ (Weight)
                let totalWeight = 0;
                weathers.forEach(w => totalWeight += w.weight); // หาผลรวมเปอร์เซ็นต์ทั้งหมด
                
                let randomNum = Math.floor(Math.random() * totalWeight);
                let selectedWeather = null;
                
                for (const w of weathers) {
                    if (randomNum < w.weight) {
                        selectedWeather = w;
                        break;
                    }
                    randomNum -= w.weight;
                }

                // 2. ระบบสุ่มอุณหภูมิในเรนจ์ (Min - Max)
                const min = selectedWeather.min_temp;
                const max = selectedWeather.max_temp;
                const randomTemp = Math.floor(Math.random() * (max - min + 1)) + min;

                // 3. จัดหน้าตาการ์ด Embed
                const weatherEmbed = new EmbedBuilder()
                    .setColor(selectedWeather.theme_color || '#a2d5f2')
                    .setTitle(`🌤️ รายงานสภาพอากาศประจำวันเมืองนางิซาโตะ`)
                    .setDescription(`**สภาพอากาศวันนี้:** ${selectedWeather.name}\n**อุณหภูมิเฉลี่ย:** ${randomTemp}°C\n\n> ${selectedWeather.description}`)
                
                if (selectedWeather.image_url && selectedWeather.image_url.startsWith('http')) {
                    weatherEmbed.setImage(selectedWeather.image_url);
                }

                await weatherChannel.send({ embeds: [weatherEmbed] });
            }
        } catch (error) {
            console.error('[Daily Weather Cron Error]', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Bangkok"
    });
    
    console.log('✅ ระบบสุ่มสภาพอากาศ (07:00 น.) เริ่มทำงานแล้ว!');
});

// Helper Function
const getSafeInput = (interaction, fieldId, fallbackValue) => {
    try {
        const value = interaction.fields.getTextInputValue(fieldId);
        return value ? value : fallbackValue;
    } catch (e) {
        return fallbackValue;
    }
};

// เมื่อมีการโต้ตอบกับบอท
client.on('interactionCreate', async interaction => {
    
    // ==========================================
    // 1. ระบบ Autocomplete
    // ==========================================
    if (interaction.isAutocomplete()) {
        try {
            const focusedOption = interaction.options.getFocused(true);
            const commandName = interaction.commandName;
            const discordId = interaction.user.id;

            if (['character_name', 'sender', 'receiver'].includes(focusedOption.name)) {
                let query = supabase.from('characters').select('name_th, status');

                if (['joika', 'offering', 'pray'].includes(commandName) || (commandName === 'transfer' && focusedOption.name === 'sender')) {
                    query = query.eq('status', 'พนักงานร้าน').eq('discord_id', discordId);
                } else if (['setdeity', 'deitymessage'].includes(commandName) || (commandName === 'transfer' && focusedOption.name === 'receiver')) {
                    query = query.eq('status', 'พนักงานร้าน');
                } else if (commandName === 'whisper') {
                    query = query.in('status', ['พนักงานร้าน', 'คนธรรมดา']);
                } else if (['editprofile', 'dropshards'].includes(commandName)) {
                    query = query.eq('discord_id', discordId);
                }

                // 🌟 2. จุดแก้ปัญหา Loading Fail: สั่งให้ Database ค้นหาเฉพาะชื่อที่กำลังพิมพ์ และจำกัดแค่ 25 อัน
                if (focusedOption.value) {
                    query = query.ilike('name_th', `%${focusedOption.value}%`);
                }
                query = query.limit(25);

                const { data, error } = await query;
                if (error || !data) return await interaction.respond([]);

                const filtered = data
                    .filter(char => char.name_th && char.name_th.includes(focusedOption.value))
                    .slice(0, 25);

                await interaction.respond(filtered.map(choice => ({ name: choice.name_th, value: choice.name_th })));
            } else {
                await interaction.respond([]);
            }
        } catch (err) {
            if (err.code !== 10062) console.error('[Autocomplete Error]', err);
        }
        return;
    }

    // ==========================================
    // 2. ระบบดักจับการกดปุ่มกิจกรรม (Button Click)
    // ==========================================
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('btn_purify_ghost_')) {
            const eventId = interaction.customId.replace('btn_purify_ghost_', '');
            
            const { data: chars, error } = await supabase.from('characters').select('name_th').eq('discord_id', interaction.user.id).eq('status', 'พนักงานร้าน');

            if (error || !chars || chars.length === 0) {
                return interaction.reply({ content: '❌ คุณยังไม่มีตัวละคร "พนักงานร้าน" ในระบบ (โปรดสร้างหรือตั้งค่าโปรไฟล์ก่อน)', ephemeral: true });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`select_purify_char_${eventId}`)
                .setPlaceholder('เลื่อนเพื่อเลือกตัวละครพนักงานร้านของคุณ')
                .addOptions(chars.map(c => ({ label: c.name_th, value: c.name_th })));

            await interaction.reply({ content: '👇 **กรุณาเลือกตัวละครที่จะส่งไปปัดเป่าวิญญาณในเหตุการณ์นี้:**', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
        }
        return;
    }

    // ==========================================
    // 3. ระบบจัดการเมื่อกดเลือก Dropdown กิจกรรม
    // ==========================================
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('select_purify_char_')) {
            const eventId = interaction.customId.replace('select_purify_char_', '');
            const characterName = interaction.values[0]; 

            const modal = new ModalBuilder()
                .setCustomId(`modal_purify_ghost_${eventId}_${characterName}`)
                .setTitle(`เข้าร่วม: ${characterName.substring(0, 30)}`); 
            
            const linkInput = new TextInputBuilder()
                .setCustomId('rp_link')
                .setLabel('ลิงก์ข้อความ Roleplay (ห้ามใช้ซ้ำ)')
                .setPlaceholder('https://discord.com/channels/...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(linkInput));
            await interaction.showModal(modal);

            try { await interaction.editReply({ content: '⏳ กำลังเปิดหน้าต่างส่งผลงาน...', components: [] }); } catch(e) {}
        }
        return;
    }

    // ==========================================
    // 4. ระบบจัดการฟอร์มกรอกข้อมูล (Modal Submit)
    // ==========================================
    if (interaction.isModalSubmit()) {
        
        // --- ฟอร์มสร้างโปรไฟล์ ---
        if (interaction.customId.startsWith('modal_createprofile_')) {
            try {
                await interaction.deferReply(); 
                const discordId = interaction.user.id;
                const status = interaction.customId.replace('modal_createprofile_', ''); 

                const nameTh = getSafeInput(interaction, 'name_th', 'ไม่ระบุ');
                const nameJp = getSafeInput(interaction, 'name_jp', '-');
                const imageUrl = getSafeInput(interaction, 'image_url', null);
                const medium = getSafeInput(interaction, 'medium', '-');
                let themeColor = getSafeInput(interaction, 'theme_color', '#ffffff');
                if (!/^#[0-9A-F]{6}$/i.test(themeColor)) themeColor = '#ffffff';

                const { data, error } = await supabase.from('characters').insert([{
                    discord_id: discordId, name_th: nameTh, name_jp: nameJp, image_url: imageUrl, 
                    status: status, medium: medium, theme_color: themeColor, item_amount: 0
                }]).select('*');

                if (error) return await interaction.editReply(`❌ เกิดข้อผิดพลาดจากฐานข้อมูล: ${error.message}`);
                if (!data || data.length === 0) return await interaction.editReply('❌ บันทึกข้อมูลสำเร็จ แต่ดึงข้อมูลกลับมาแสดงไม่ได้');

                const char = data[0];
                const embed = new EmbedBuilder().setColor(char.theme_color).setTitle(`✅ สร้างโปรไฟล์สำเร็จ: ${char.name_th}`)
                    .setDescription(`ตัวละครของคุณถูกบันทึกแล้ว! สามารถใช้คำสั่ง \`/profile\` เพื่อดูข้อมูลเต็มๆ ได้เลย`);

                await interaction.editReply({ embeds: [embed] });
            } catch (err) {
                if (interaction.deferred || interaction.replied) await interaction.editReply(`❌ เกิดข้อผิดพลาดของระบบ: ${err.message}`);
                else await interaction.reply({ content: `❌ เกิดข้อผิดพลาดของระบบ: ${err.message}`, ephemeral: true });
            }
        }

        // --- ฟอร์มแอดมินสร้างเหตุการณ์พบวิญญาณ ---
        else if (interaction.customId === 'modal_spawnghost') {
            await interaction.deferReply();
            
            const description = getSafeInput(interaction, 'description', '');
            const location = getSafeInput(interaction, 'location', 'ไม่ระบุ');
            const quantityRaw = getSafeInput(interaction, 'quantity', '0');
            const dropRateRaw = getSafeInput(interaction, 'drop_rate', '0-0');
            const imageUrl = getSafeInput(interaction, 'image_url', null);

            const quantity = parseInt(quantityRaw);
            if (isNaN(quantity) || quantity <= 0) return interaction.editReply('❌ กรุณาใส่จำนวนวิญญาณเป็นตัวเลขที่มากกว่า 0');

            const dropParts = dropRateRaw.split('-');
            if (dropParts.length !== 2) return interaction.editReply('❌ กรุณาใส่รูปแบบการดรอปให้ถูกต้อง เช่น 1-5');

            const minDrop = parseInt(dropParts[0]);
            const maxDrop = parseInt(dropParts[1]);

            if (isNaN(minDrop) || isNaN(maxDrop) || minDrop < 0 || maxDrop < minDrop) {
                return interaction.editReply('❌ กรุณาใส่ตัวเลขการดรอปให้ถูกต้อง (Min ต้องไม่ติดลบ และ Max ต้องมากกว่าหรือเท่ากับ Min)');
            }

            const { data: eventData, error: eventError } = await supabase.from('ghost_events').insert([{
                description: description, location: location, quantity: quantity, min_drop: minDrop, max_drop: maxDrop, is_active: true
            }]).select().single();

            if (eventError) return interaction.editReply(`❌ เกิดข้อผิดพลาดจากฐานข้อมูล: ${eventError.message}`);

            const eventEmbed = new EmbedBuilder().setColor('#7d6258').setTitle('🏮 พบวิญญาณเร่ร่อนปรากฏตัว').setDescription(`"${description}"`)
                .addFields(
                    { name: '📍 สถานที่', value: `> ${location}`, inline: true },
                    { name: '👻 วิญญาณคงเหลือ', value: `> **${quantity}** ตน`, inline: true },
                    { name: '<:spiritshard:1513812652839800882> ผลตอบแทนเมื่อปัดเป่าสำเร็จ', value: `> สุ่มได้รับเสี้ยววิญญาณบริสุทธิ์ **${minDrop} - ${maxDrop}** ชิ้น`, inline: false }
                ).setFooter({ text: 'พนักงานร้านสามารถกดปุ่มส่งลิงก์เพื่อทำภารกิจปัดเป่าได้ (หักเสี้ยววิญญาณ 1 ชิ้น/ครั้ง)' });

            if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) eventEmbed.setImage(imageUrl);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`btn_purify_ghost_${eventData.id}`).setLabel('👻 เข้าร่วมปัดเป่าวิญญาณ').setStyle(ButtonStyle.Danger)
            );

            let pingText = null;
            if (PING_EVENT_ROLE_ID && PING_EVENT_ROLE_ID.trim() !== '') {
                pingText = (PING_EVENT_ROLE_ID.toLowerCase() === 'everyone' || PING_EVENT_ROLE_ID.toLowerCase() === 'here') 
                    ? `@${PING_EVENT_ROLE_ID}` : `<@&${PING_EVENT_ROLE_ID}>`;
            }

            const payload = { embeds: [eventEmbed], components: [row] };
            if (pingText) {
                payload.content = pingText;
                payload.allowedMentions = { parse: ['roles', 'everyone'] }; 
            }

            const message = await interaction.editReply(payload);
            await supabase.from('ghost_events').update({ message_id: message.id, channel_id: interaction.channelId }).eq('id', eventData.id);
        }

        // --- ฟอร์มส่งผลงานปัดเป่าวิญญาณ (ส่งลิงก์) ---
        else if (interaction.customId.startsWith('modal_purify_ghost_')) {
            await interaction.deferReply(); 
            
            const prefixLength = 'modal_purify_ghost_'.length;
            const rest = interaction.customId.substring(prefixLength);
            const firstUnderscoreIdx = rest.indexOf('_');
            const eventId = rest.substring(0, firstUnderscoreIdx);
            const characterName = rest.substring(firstUnderscoreIdx + 1);

            const rpLink = getSafeInput(interaction, 'rp_link', '');
            const discordId = interaction.user.id;

            const { data: linkData } = await supabase.from('rp_links').select('link').eq('link', rpLink).single();
            if (linkData) return interaction.editReply('❌ ลิงก์โรลเพลย์นี้เคยถูกนำมาใช้ไปแล้ว (ห้ามส่งซ้ำ)');

            const { data: eventData } = await supabase.from('ghost_events').select('*').eq('id', eventId).single();
            if (!eventData || !eventData.is_active || eventData.quantity <= 0) return interaction.editReply('❌ เหตุการณ์นี้ได้จบลงแล้ว หรือวิญญาณเร่ร่อนถูกปัดเป่าไปหมดแล้ว');

            const { data: charData } = await supabase.from('characters').select('*').eq('name_th', characterName).eq('discord_id', discordId).eq('status', 'พนักงานร้าน').single();
            if (!charData) return interaction.editReply('❌ ไม่พบตัวละครพนักงานร้านชื่อนี้ หรือคุณไม่ใช่เจ้าของตัวละคร');
            
            const currentAmount = charData.item_amount || 0;
            if (currentAmount < 1) return interaction.editReply(`❌ ปัดเป่าล้มเหลว! **${charData.name_th}** มีเสี้ยววิญญาณบริสุทธิ์ไม่เพียงพอ (ต้องการ 1 ชิ้น)`);

            const dropAmount = Math.floor(Math.random() * (eventData.max_drop - eventData.min_drop + 1)) + eventData.min_drop;
            const newTotal = currentAmount - 1 + dropAmount;

            await supabase.from('characters').update({ item_amount: newTotal }).eq('id', charData.id);
            await supabase.from('rp_links').insert([{ link: rpLink, character_name: characterName, discord_id: discordId }]);

            const newQuantity = eventData.quantity - 1;
            const isActive = newQuantity > 0;
            await supabase.from('ghost_events').update({ quantity: newQuantity, is_active: isActive }).eq('id', eventId);

            const successEmbed = new EmbedBuilder().setColor(charData.theme_color || '#ffffff').setTitle(`🏮 ปัดเป่าวิญญาณเร่ร่อนสำเร็จ!`)
                .setDescription(`**${charData.name_th}** ปัดเป่าวิญญาณเร่ร่อนสำเร็จ\n\n> ใช้เสี้ยววิญญาณไป: 1 ชิ้น\n> ได้รับเสี้ยววิญญาณบริสุทธิ์คืนมา: **${dropAmount}** ชิ้น\n> ปัจจุบันถือครองทั้งหมด: **${newTotal}** ชิ้น`);
            
            await interaction.editReply({ embeds: [successEmbed] });

            try {
                const channel = await client.channels.fetch(eventData.channel_id);
                const originalMessage = await channel.messages.fetch(eventData.message_id);
                const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
                updatedEmbed.data.fields[1] = { name: '👻 วิญญาณคงเหลือ', value: `> **${newQuantity}** ตน`, inline: true };

                const row = ActionRowBuilder.from(originalMessage.components[0]);
                if (!isActive) {
                    row.components[0].setDisabled(true).setLabel('วิญญาณถูกปัดเป่าหมดแล้ว').setStyle(ButtonStyle.Secondary);
                    updatedEmbed.setColor('#808080'); 
                }
                await originalMessage.edit({ embeds: [updatedEmbed], components: [row] });
            } catch (err) { console.error('Error updating event message:', err); }
        }
        return;
    }

    // ==========================================
    // 5. ระบบคำสั่งสแลช (Slash Commands)
    // ==========================================
    if (interaction.isChatInputCommand()) {
        try {
            // --- คำสั่งสร้างโปรไฟล์ (แบบ Modal ไม่ต้อง Defer) ---
            if (interaction.commandName === 'createprofile') {
                const status = interaction.options.getString('status');
                const modal = new ModalBuilder().setCustomId(`modal_createprofile_${status}`).setTitle('สร้างโปรไฟล์ตัวละคร');
                
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name_th').setLabel('ชื่อภาษาไทย').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name_jp').setLabel('ชื่อภาษาญี่ปุ่น').setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image_url').setLabel('ลิงก์รูปภาพประจำตัว (.png / .jpg)').setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('medium').setLabel('สื่อกลางที่ใช้').setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('theme_color').setLabel('สีตกแต่ง (Hex Code)').setPlaceholder('เว้นว่างไว้เพื่อใช้สีขาว').setStyle(TextInputStyle.Short).setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            // --- คำสั่งประกาศ Spawn Ghost (แบบ Modal ไม่ต้อง Defer) ---
            if (interaction.commandName === 'spawnghost') {
                const isServerAdmin = interaction.member?.permissions.has('Administrator') || false;
                const isListAdmin = ALLOWED_ADMINS.includes(interaction.user.id);
                if (!isServerAdmin && !isListAdmin) return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์เข้าถึงคำสั่งนี้', ephemeral: true });

                const modal = new ModalBuilder().setCustomId('modal_spawnghost').setTitle('🏮 ประกาศเหตุการณ์วิญญาณเร่ร่อน');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('รายละเอียดสถานการณ์').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('location').setLabel('สถานที่ที่พบ').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantity').setLabel('จำนวนวิญญาณ').setPlaceholder('ใส่เป็นตัวเลข').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('drop_rate').setLabel('ช่วงการดรอปของ (Min-Max)').setPlaceholder('เช่น 1-5').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image_url').setLabel('ลิงก์ภาพประกอบ (ไม่บังคับ)').setStyle(TextInputStyle.Short).setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            // ==========================================
            // คำสั่งอื่นๆ ทั้งหมด (ใช้การโต้ตอบแบบปกติ)
            // ==========================================
            await interaction.deferReply();

            if (interaction.commandName === 'transfer') {
                const senderName = interaction.options.getString('sender');
                const receiverName = interaction.options.getString('receiver');
                const amount = interaction.options.getInteger('amount');
                const discordId = interaction.user.id;

                if (amount <= 0) return interaction.editReply('❌ กรุณาระบุจำนวนที่มากกว่า 0');
                if (senderName === receiverName) return interaction.editReply('❌ ไม่สามารถส่งให้กับตัวเองได้');

                const { data: senderData } = await supabase.from('characters').select('*').eq('name_th', senderName).eq('discord_id', discordId).eq('status', 'พนักงานร้าน').single();
                if (!senderData) return interaction.editReply('❌ ไม่พบตัวละครผู้ส่ง หรือไม่ใช่ตัวละครของคุณ');
                if ((senderData.item_amount || 0) < amount) return interaction.editReply(`❌ ยอดไม่พอ! (ต้องการ ${amount} | มี ${senderData.item_amount || 0})`);

                const { data: receiverData } = await supabase.from('characters').select('*').eq('name_th', receiverName).eq('status', 'พนักงานร้าน').single();
                if (!receiverData) return interaction.editReply('❌ ไม่พบตัวละครผู้รับปลายทาง');

                await supabase.from('characters').update({ item_amount: (senderData.item_amount || 0) - amount }).eq('id', senderData.id);
                await supabase.from('characters').update({ item_amount: (receiverData.item_amount || 0) + amount }).eq('id', receiverData.id);

                const successEmbed = new EmbedBuilder().setColor('#508050').setTitle(`💸 ส่งเสี้ยววิญญาณสำเร็จ!`)
                    .setDescription(`**${senderData.name_th}** ส่งวิญญาณ **${amount}** ชิ้น ให้ **${receiverData.name_th}** เรียบร้อย\n> คงเหลือผู้ส่ง: ${(senderData.item_amount || 0) - amount}\n> คงเหลือผู้รับ: ${(receiverData.item_amount || 0) + amount}`);
                await interaction.editReply({ embeds: [successEmbed] });
            }

            else if (interaction.commandName === 'pray') {
                const characterName = interaction.options.getString('character_name');
                const messageStr = interaction.options.getString('message');
                const discordId = interaction.user.id;
                const cost = 5; 

                const { data: charData } = await supabase.from('characters').select('*').eq('name_th', characterName).eq('discord_id', discordId).eq('status', 'พนักงานร้าน').single();
                if (!charData) return interaction.editReply('❌ ไม่พบตัวละครชื่อนี้ หรือไม่ใช่ของคุณ');
                if (!charData.deity_id) return interaction.editReply('❌ ยังไม่มีเทพประจำตัว ไม่สามารถส่งข้อความได้');

                if ((charData.item_amount || 0) < cost) return interaction.editReply(`❌ ยอดไม่พอ! (ต้องการ ${cost} | มี ${charData.item_amount || 0})`);

                const { data: deityData } = await supabase.from('deities').select('name, title').eq('id', charData.deity_id).single();
                const newTotal = (charData.item_amount || 0) - cost;
                await supabase.from('characters').update({ item_amount: newTotal }).eq('id', charData.id);

                const msgEmbed = new EmbedBuilder()
                    .setColor(charData.theme_color || '#ffffff')
                    .setTitle(`🙏 ข้อความถึง ${deityData ? deityData.name : 'เทพ'}`)
                    .setDescription(`"${messageStr}"`)
                    .addFields({ name: 'ผู้ส่งสาร', value: `> **${charData.name_th}**`, inline: true }, { name: 'จ่ายเสี้ยววิญญาณ', value: `> **${cost}** ชิ้น (เหลือ ${newTotal})`, inline: true });
                if (charData.image_url && charData.image_url !== '-') msgEmbed.setThumbnail(charData.image_url);

                try {
                    const targetThread = await client.channels.fetch(DEITY_THREAD_ID);
                    let pingText = (PING_ADMIN_ROLE_ID && PING_ADMIN_ROLE_ID !== 'ใส่_ID_ยศแอดมินตรงนี้') ? `<@&${PING_ADMIN_ROLE_ID}>` : '';
                    if (pingText === '<@&everyone>' || pingText === '<@&here>') pingText = '@everyone';

                    const payload = { embeds: [msgEmbed] };
                    if (pingText) {
                        payload.content = pingText;
                        payload.allowedMentions = { parse: ['roles', 'everyone'] }; 
                    }
                    
                    // 1. ส่งคำอธิษฐานเข้าเธรด (พร้อมแท็กแอดมิน)
                    await targetThread.send(payload);
                    
                    // 2. ลบข้อความที่ Defer ไว้ทิ้งไปเลย (ผู้เล่นจะไม่เห็นผลลัพธ์ใดๆ ในช่องแชทที่พิมพ์)
                    await interaction.deleteReply();
                    
                } catch (err) {
                    await interaction.editReply(`❌ เกิดข้อผิดพลาด: หักของแล้วแต่ไม่สามารถส่งลงเธรดได้ (โปรดเช็ก ID เธรด)`);
                }
            }

            else if (interaction.commandName === 'deitymessage') {
                const isServerAdmin = interaction.member?.permissions.has('Administrator') || false;
                const isListAdmin = ALLOWED_ADMINS.includes(interaction.user.id);
                if (!isServerAdmin && !isListAdmin) return interaction.editReply('❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้');

                const characterName = interaction.options.getString('character_name');
                const cost = interaction.options.getInteger('cost');
                const messageStr = interaction.options.getString('message');

                if (cost < 0) return interaction.editReply('❌ ระบุจำนวนมากกว่าหรือเท่ากับ 0');
                const { data: charData } = await supabase.from('characters').select('*').eq('name_th', characterName).eq('status', 'พนักงานร้าน').single();
                if (!charData) return interaction.editReply('❌ ไม่พบตัวละครผู้รับสาร');
                if (!charData.deity_id) return interaction.editReply('❌ ตัวละครนี้ยังไม่มีเทพ');
                if ((charData.item_amount || 0) < cost) return interaction.editReply(`❌ ตัวละครนี้มียอดไม่พอรับสาร (มี ${charData.item_amount || 0} / ต้องการ ${cost})`);

                const { data: deityData } = await supabase.from('deities').select('name, title').eq('id', charData.deity_id).single();
                const newTotal = (charData.item_amount || 0) - cost;
                await supabase.from('characters').update({ item_amount: newTotal }).eq('id', charData.id);

                const msgEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle(`📜 สารจาก ${deityData ? deityData.name : 'เทพ'} (${deityData ? deityData.title : 'ไร้นาม'})`)
                    .setDescription(`"||${messageStr}||"`)
                    .addFields({ name: 'ผู้รับสาร', value: `> **${charData.name_th}**`, inline: true }, { name: 'จ่ายเสี้ยววิญญาณ', value: `> **${cost}** ชิ้น (เหลือ ${newTotal})`, inline: true });
                if (charData.image_url && charData.image_url !== '-') msgEmbed.setThumbnail(charData.image_url);

                try {
                    const targetThread = await client.channels.fetch(DEITY_THREAD_ID);
                    await targetThread.send({ content: `<@${charData.discord_id}>`, embeds: [msgEmbed], allowedMentions: { users: [charData.discord_id] } });
                    await interaction.editReply(`✅ ส่งสารจากเทพถึง **${charData.name_th}** ลงเธรด <#${DEITY_THREAD_ID}> เรียบร้อย!`);
                } catch (err) {
                    await interaction.editReply(`❌ เกิดข้อผิดพลาด: หักของแล้วแต่ส่งข้อความลงเธรดไม่ได้`);
                }
            }

            else if (interaction.commandName === 'whisper') {
                const isServerAdmin = interaction.member?.permissions.has('Administrator') || false;
                const isListAdmin = ALLOWED_ADMINS.includes(interaction.user.id);
                if (!isServerAdmin && !isListAdmin) return interaction.editReply('❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้');

                const characterName = interaction.options.getString('character_name');
                const cost = interaction.options.getInteger('cost');
                const messageStr = interaction.options.getString('message');

                if (cost < 0) return interaction.editReply('❌ ระบุจำนวนมากกว่าหรือเท่ากับ 0');
                const { data: charData } = await supabase.from('characters').select('*').eq('name_th', characterName).eq('status', 'พนักงานร้าน').single();
                if (!charData) return interaction.editReply('❌ ไม่พบตัวละครผู้รับสาร');
                if ((charData.item_amount || 0) < cost) return interaction.editReply(`❌ ตัวละครนี้มียอดไม่พอ (มี ${charData.item_amount || 0} / ต้องการ ${cost})`);

                const newTotal = (charData.item_amount || 0) - cost;
                if (cost > 0) await supabase.from('characters').update({ item_amount: newTotal }).eq('id', charData.id);

                const msgEmbed = new EmbedBuilder().setColor('#332862').setTitle(`🌌 เสียงกระซิบปริศนา...`).setDescription(`*||" ${messageStr} "||*`)
                    .addFields({ name: 'ผู้ได้รับสาร', value: `> **${charData.name_th}**`, inline: true });
                if (cost > 0) msgEmbed.addFields({ name: 'จ่ายเสี้ยววิญญาณ', value: `> **${cost}** ชิ้น (เหลือ ${newTotal})`, inline: true });
                if (charData.image_url && charData.image_url !== '-') msgEmbed.setThumbnail(charData.image_url);

                try {
                    const targetThread = await client.channels.fetch(DEITY_THREAD_ID);
                    await targetThread.send({ content: `<@${charData.discord_id}>`, embeds: [msgEmbed], allowedMentions: { users: [charData.discord_id] } });
                    await interaction.editReply(`✅ ส่งเสียงกระซิบถึง **${charData.name_th}** ลงเธรด <#${DEITY_THREAD_ID}> เรียบร้อย!`);
                } catch (err) {
                    await interaction.editReply(`❌ เกิดข้อผิดพลาด: หักของแล้วแต่ส่งข้อความลงเธรดไม่ได้`);
                }
            }

            else if (interaction.commandName === 'setdeity') {
                const characterName = interaction.options.getString('character_name');
                const deityId = interaction.options.getInteger('deity_id');
                const { data: deityData } = await supabase.from('deities').select('name, title').eq('id', deityId).single();
                if (!deityData) return interaction.editReply('❌ ไม่พบเทพ ID นี้');

                const { data: updateData } = await supabase.from('characters').update({ deity_id: deityId }).eq('name_th', characterName).eq('status', 'พนักงานร้าน').select('*');
                if (!updateData || updateData.length === 0) return interaction.editReply('❌ ไม่พบตัวละคร หรือไม่ใช่พนักงานร้าน');

                const char = updateData[0];
                await interaction.editReply({ embeds: [new EmbedBuilder().setColor(char.theme_color || '#ffffff').setTitle(`✨ จดจำเทพผู้ประทับตราคงอินสำเร็จ!`).setDescription(`**${char.name_th}** ทำพันธสัญญากับ **${deityData.name} (${deityData.title})** แล้ว`)] });
            }

            else if (interaction.commandName === 'deities') {
                const { data } = await supabase.from('deities').select('*').order('id', { ascending: true });
                if (!data || data.length === 0) return interaction.editReply('❌ ยังไม่มีข้อมูลเทพในระบบ');
                await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ffd700').setTitle('✨ รายนามเทพทั้งหมด').setDescription(data.map(d => `> **ID: ${d.id}** | ${d.name} (${d.title})`).join('\n'))] });
            }

            else if (interaction.commandName === 'editprofile') {
                const characterName = interaction.options.getString('character_name');
                const updates = {};
                ['status', 'age', 'height', 'weight', 'likes', 'dislikes', 'medium', 'image_url', 'banner_url', 'theme_color'].forEach(field => {
                    const value = interaction.options.getString(field);
                    if (value !== null) updates[field] = value;
                });

                if (updates.theme_color && !/^#[0-9A-F]{6}$/i.test(updates.theme_color)) updates.theme_color = '#ffffff';
                if (Object.keys(updates).length === 0) return interaction.editReply('❌ ไม่ได้ระบุข้อมูลที่ต้องการแก้ไข');

                const { data: updateData } = await supabase.from('characters').update(updates).eq('name_th', characterName).eq('discord_id', interaction.user.id).select('*');
                if (!updateData || updateData.length === 0) return interaction.editReply('❌ ไม่พบตัวละคร หรือคุณไม่ใช่เจ้าของ');

                await interaction.editReply({ embeds: [new EmbedBuilder().setColor(updateData[0].theme_color).setTitle(`✅ แก้ไขโปรไฟล์สำเร็จ`).setDescription(`อัปเดตข้อมูลของ **${updateData[0].name_th}** เรียบร้อยแล้ว`)] });
            }

            else if (interaction.commandName === 'dropshards') {
                const characterName = interaction.options.getString('character_name');
                const { data: charData } = await supabase.from('characters').select('*').eq('name_th', characterName).eq('discord_id', interaction.user.id).single();
                if (!charData) return interaction.editReply('❌ ไม่พบตัวละคร หรือคุณไม่ใช่เจ้าของ');
                if (!charData.deity_id) return interaction.editReply('❌ ตัวละครนี้ยังไม่มีเทพประจำตัว');

                const { data: deityData } = await supabase.from('deities').select('*').eq('id', charData.deity_id).single();
                const min = deityData.min_item_drop || 1;
                const max = deityData.max_item_drop || 5;
                const dropAmount = Math.floor(Math.random() * (max - min + 1)) + min;
                const newTotal = (charData.item_amount || 0) + dropAmount;

                await supabase.from('characters').update({ item_amount: newTotal }).eq('id', charData.id);
                await interaction.editReply({ embeds: [new EmbedBuilder().setColor(charData.theme_color || '#ffffff').setTitle(`✨ เข้างานที่ร้านหนังสือ`).setDescription(`**${charData.name_th}** ได้รับเสี้ยววิญญาณ **${dropAmount}** ชิ้น (รวม: ${newTotal})`)] });
            }

            else if (interaction.commandName === 'addshards') {
                const characterName = interaction.options.getString('character_name');
                const amount = interaction.options.getInteger('amount');
                const { data: charData } = await supabase.from('characters').select('*').eq('name_th', characterName).single();
                if (!charData) return interaction.editReply('❌ ไม่พบตัวละครชื่อนี้');

                const newTotal = (charData.item_amount || 0) + amount;
                await supabase.from('characters').update({ item_amount: newTotal }).eq('id', charData.id);
                await interaction.editReply({ embeds: [new EmbedBuilder().setColor(charData.theme_color || '#ffffff').setTitle(`✅ มอบเสี้ยววิญญาณ`).setDescription(`เพิ่มให้ **${charData.name_th}** จำนวน **${amount}** ชิ้น (รวม: ${newTotal})`)] });
            }

            else if (interaction.commandName === 'joika') {
                const characterName = interaction.options.getString('character_name');
                const level = interaction.options.getString('level');
                const { data: charData } = await supabase.from('characters').select('*').eq('name_th', characterName).eq('discord_id', interaction.user.id).eq('status', 'พนักงานร้าน').single();
                if (!charData) return interaction.editReply('❌ ไม่พบตัวละคร หรือไม่ใช่พนักงานร้าน');
                if (!charData.deity_id) return interaction.editReply('❌ ตัวละครนี้ยังไม่มีเทพ');

                const { data: deityData } = await supabase.from('deities').select('*').eq('id', charData.deity_id).single();
                let min, max, levelName;
                if (level === 'konten') { min = deityData.min_konten_use || 1; max = deityData.max_konten_use || 5; levelName = 'คงเท็น ไคชิกิ'; } 
                else if (level === 'matoe') { min = deityData.min_matoe_use || 1; max = deityData.max_matoe_use || 5; levelName = 'มาโตเอะ เรย์โซ'; } 
                else if (level === 'shini') { min = deityData.min_shini_use || 1; max = deityData.max_shini_use || 5; levelName = 'ชินอิ เค็นเก็น'; }

                const cost = Math.floor(Math.random() * (max - min + 1)) + min;
                if ((charData.item_amount || 0) < cost) return interaction.editReply(`❌ ล้มเหลว! (ต้องการ ${cost} | มี ${charData.item_amount || 0})`);

                const newTotal = (charData.item_amount || 0) - cost;
                await supabase.from('characters').update({ item_amount: newTotal }).eq('id', charData.id);

                await interaction.editReply({ embeds: [new EmbedBuilder().setColor(charData.theme_color || '#3d803d').setTitle(`🔮 ประกอบพิธีโจอิกะสำเร็จ!`).setDescription(`**${charData.name_th}** ทำพิธีโจอิกะ **${levelName}** ได้อย่างสมบูรณ์!\n> ใช้ไป ${cost} ชิ้น (เหลือ ${newTotal})`)] });
            }

            else if (interaction.commandName === 'offering') {
                const characterName = interaction.options.getString('character_name');
                const amount = interaction.options.getInteger('amount');
                if (amount <= 0) return interaction.editReply('❌ ระบุมากกว่า 0');

                const { data: charData } = await supabase.from('characters').select('*').eq('name_th', characterName).eq('discord_id', interaction.user.id).eq('status', 'พนักงานร้าน').single();
                if (!charData) return interaction.editReply('❌ ไม่พบตัวละคร หรือไม่ใช่พนักงานร้าน');
                if (!charData.deity_id) return interaction.editReply('❌ ตัวละครนี้ยังไม่มีเทพ');
                if ((charData.item_amount || 0) < amount) return interaction.editReply(`❌ ล้มเหลว! ยอดไม่พอ`);

                const { data: deityData } = await supabase.from('deities').select('name, title').eq('id', charData.deity_id).single();
                const newTotal = (charData.item_amount || 0) - amount;
                await supabase.from('characters').update({ item_amount: newTotal }).eq('id', charData.id);

                await interaction.editReply({ embeds: [new EmbedBuilder().setColor(charData.theme_color || '#ffd700').setTitle(`🙏 การถวายสำเร็จ`).setDescription(`**${charData.name_th}** ถวายวิญญาณ **${amount}** ชิ้น แด่ **${deityData.name}**\n> คงเหลือ ${newTotal} ชิ้น`)] });
            }

            else if (interaction.commandName === 'profile') {
                const characterName = interaction.options.getString('character_name');
                let char;

                if (characterName) {
                    const { data } = await supabase.from('characters').select('*').eq('name_th', characterName);
                    if (!data || data.length === 0) return interaction.editReply('❌ ไม่พบตัวละครชื่อนี้');
                    if (data.length > 1) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle(`⚠️ พบชื่อซ้ำกัน`).setDescription(data.map(c => `🔹 **${c.name_th}** (<@${c.discord_id}>)`).join('\n'))] });
                    char = data[0];
                } else {
                    const { data } = await supabase.from('characters').select('*').eq('discord_id', interaction.user.id);
                    if (!data || data.length === 0) return interaction.editReply('❌ ยังไม่มีตัวละคร');
                    if (data.length > 1) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ffffff').setTitle(`📋 รายชื่อตัวละครของคุณ`).setDescription(data.map(c => `🔹 **${c.name_th}**`).join('\n'))] });
                    char = data[0];
                }

                let deityDisplay = 'ยังไม่ระบุ';
                if (char.deity_id) {
                    const { data: deityData } = await supabase.from('deities').select('name, title').eq('id', char.deity_id).single();
                    if (deityData) deityDisplay = `${deityData.name} (${deityData.title})`;
                }

                const formatList = str => (!str || str === '-') ? '> ไม่ระบุ' : str.split(',').map(item => `> • ${item.trim()}`).filter(i => i !== '> •').join('\n');
                
                const profileEmbed = new EmbedBuilder().setColor(char.theme_color || '#ffffff')
                    .setTitle(`👤 ${char.name_th} ${char.name_jp && char.name_jp !== '-' ? `(${char.name_jp})` : ''}`)
                    .setDescription(`ผู้ถือครอง: <@${char.discord_id}>\n──────────────────`)
                    .addFields(
                        { name: 'สถานะ', value: `> ${char.status || 'ไม่ระบุ'}`, inline: false },
                        { name: 'อายุ', value: `> ${char.age || 'ไม่ระบุ'}`, inline: false },
                        { name: 'ส่วนสูง / น้ำหนัก', value: `> ${char.height || '?'} / ${char.weight || '?'}`, inline: false },
                        { name: 'สิ่งที่ชอบ', value: formatList(char.likes), inline: false },
                        { name: 'สิ่งที่ไม่ชอบ', value: formatList(char.dislikes), inline: false },
                        { name: 'สื่อกลาง', value: `> ${char.medium || 'ไม่ระบุ'}`, inline: false },
                        { name: 'เทพประจำตัว', value: `> ${deityDisplay}`, inline: false },
                        { name: 'เสี้ยววิญญาณบริสุทธิ์', value: `> ${char.item_amount || 0} ชิ้น`, inline: false }
                    );

                if (char.image_url && char.image_url !== '-') profileEmbed.setThumbnail(char.image_url);
                if (char.banner_url && char.banner_url !== '-') profileEmbed.setImage(char.banner_url);

                await interaction.editReply({ embeds: [profileEmbed] });
            }

        } catch (err) {
            console.error('[Slash Command System Error]', err);
            const msg = `❌ เกิดข้อผิดพลาดของระบบ: ${err.message}`;
            if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(()=>{});
            else await interaction.reply({ content: msg, ephemeral: true }).catch(()=>{});
        }
    }
});

client.login(process.env.DISCORD_TOKEN);