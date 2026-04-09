const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

const CONFIG = {
    youtube: {
        clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
        clientSecret: "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",
        refreshToken: "1//04hgJOolYNBB5CgYIARAAGAQSNwF-L9IrGrgA_DqmX6TkCLEGL78AaE9KBudlm86mGniqcUJiV6b4x2OPDeK-M86sg8dG5TymNOU"
    },
    brandName: "كيرو زوزو",
    siteUrl: "https://redirectauto4kiro.blogspot.com",
    dbFile: 'history.json',
    tiktokAccounts: [
        'https://www.tiktok.com/@tonnysweden'
    ]
};

const oauth2Client = new google.auth.OAuth2(CONFIG.youtube.clientId, CONFIG.youtube.clientSecret);
oauth2Client.setCredentials({ refresh_token: CONFIG.youtube.refreshToken });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 1. دالة تنظيف العنوان (إزالة الهاشتاجات، المنشن، وجعله طبيعياً)
function cleanTitle(rawTitle) {
    let title = rawTitle
        .replace(/#\S+/g, '') // إزالة كل الهاشتاجات
        .replace(/@\S+/g, '') // إزالة كل المنشن
        .replace(/(?:https?|ftp):\/\/[\n\S]+/g, '') // إزالة الروابط
        .replace(/[^\u0600-\u06FF\w\s]/g, '') // إزالة الرموز الغريبة والإيموجي الكثيف
        .replace(/\s+/g, ' ') // إزالة المسافات الزائدة
        .trim();

    // إذا أصبح العنوان فارغاً بعد التنظيف، نضع عنواناً جذاباً افتراضياً
    if (title.length < 5) {
        const fallbacks = ["أقوى مشهد سينمائي", "لقطة لا تُنسى", "من أجمل المشاهد", "مشهد رهيب جداً"];
        title = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    // قص العنوان بذكاء لكي لا يتخطى 60 حرفاً بدون قطع الكلمات
    if (title.length > 60) {
        title = title.substring(0, 60);
        title = title.substring(0, Math.min(title.length, title.lastIndexOf(" "))); 
    }

    return title;
}

// 2. دالة بناء وصف متغير (ديناميكي) لتجنب السبام
function buildSEODescription(cleanTitle) {
    // تشكيلة من الجمل لتغيير الوصف في كل فيديو
    const intros = [
        "نتمنى لكم مشاهدة ممتعة مع هذا المقطع.",
        "مشهد رائع يستحق المشاهدة، لا تفوته!",
        "من أجمل اللقطات التي اخترناها لكم اليوم.",
        "استمتع بأفضل اللقطات السينمائية معنا."
    ];
    const randomIntro = intros[Math.floor(Math.random() * intros.length)];

    return `${cleanTitle}\n\n` +
           `${randomIntro}\n` +
           `قناة ${CONFIG.brandName} تقدم لكم مقتطفات من أفضل الأعمال الفنية والدرامية.\n` +
           `لا تنسَ الاشتراك في القناة ليصلك كل جديد.\n\n` +
           `#أفلام #سينما #مشاهد_قصيرة #دراما`; // هاشتاجات قليلة وطبيعية
}

// 3. دالة توليد كلمات مفتاحية نظيفة
function generateTags(cleanTitle) {
    const basicTags = ['أفلام', 'مسلسلات', 'سينما', 'مشاهد', 'دراما'];
    // إضافة كلمات من العنوان نفسه
    const titleTags = cleanTitle.split(' ').filter(word => word.length > 3).slice(0, 4);
    return [...new Set([...basicTags, ...titleTags])];
}

async function startProfessionalAutomation() {
    let history = fs.existsSync(CONFIG.dbFile) ? JSON.parse(fs.readFileSync(CONFIG.dbFile)) : [];
    
    console.log("🔄 فحص الحسابات لنشر فيديو واحد فقط...");

    for (const account of CONFIG.tiktokAccounts) {
        console.log(`\n🔎 فحص الحساب: ${account}`);
        
        try {
            const idsRaw = execSync(`yt-dlp --impersonate chrome --flat-playlist --get-id "${account}"`, { encoding: 'utf-8' });
            let allIds = idsRaw.trim().split('\n').filter(id => id.trim().length > 0);

            if (allIds.length === 0) continue;

            allIds.reverse();
            const nextId = allIds.find(id => !history.includes(id));

            if (nextId) {
                console.log(`🎯 تم العثور على فيديو مستهدف: ${nextId}`);
                
                // 1. التحميل
                console.log("📥 جاري التحميل...");
                execSync(`yt-dlp --impersonate chrome -f "bestvideo[height<=1080]+bestaudio/best" -o "input.mp4" "https://www.tiktok.com/@any/video/${nextId}"`);
                
                // 2. المونتاج (لتغيير بصمة الفيديو)
                console.log("🎨 معالجة الفيديو تقنياً...");
                execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.1:ih*1.1,crop=iw/1.1:ih/1.1,eq=brightness=0.03:contrast=1.05" -map_metadata -1 -c:v libx264 -crf 20 -c:a aac -y output.mp4`);

                // 3. جلب وتجهيز العنوان
                let rawTitle = "مشهد سينمائي";
                try { 
                    rawTitle = execSync(`yt-dlp --impersonate chrome --get-title "https://www.tiktok.com/@any/video/${nextId}"`, { encoding: 'utf-8' }).trim(); 
                } catch(e){}

                // معالجة العنوان برمجياً ليصبح نظيفاً واحترافياً
                const finalTitle = cleanTitle(rawTitle);

                // 4. الرفع إلى يوتيوب
                console.log(`📤 جاري الرفع إلى يوتيوب بعنوان: "${finalTitle}"`);
                const upload = await youtube.videos.insert({
                    part: 'snippet,status',
                    requestBody: {
                        snippet: {
                            title: finalTitle, // العنوان النظيف بدون هاشتاج
                            description: buildSEODescription(finalTitle), // الوصف المتغير
                            tags: generateTags(finalTitle),
                            categoryId: '24', // Entertainment
                            defaultLanguage: 'ar',
                            defaultAudioLanguage: 'ar'
                        },
                        status: { 
                            privacyStatus: 'public', 
                            selfDeclaredMadeForKids: false 
                        }
                    },
                    media: { body: fs.createReadStream('output.mp4') }
                });

                const newId = upload.data.id;
                console.log(`✅ نُشر بنجاح: https://youtu.be/${newId}`);

                // 5. حفظ السجل
                history.push(nextId);
                fs.writeFileSync(CONFIG.dbFile, JSON.stringify(history, null, 2));

                // ==========================================
                // 6. ميزة التعليق التلقائي (تم تجميدها حالياً لتجنب السبام)
                // ==========================================
                /*
                console.log("⏳ انتظار 1 دقيقة للتعليق...");
                await delay(60000);
                try {
                    await youtube.commentThreads.insert({
                        part: 'snippet',
                        requestBody: {
                            snippet: {
                                videoId: newId,
                                topLevelComment: { snippet: { textOriginal: `🍿 لمشاهدة الأفلام والمسلسلات كاملة زوروا موقعنا: ${CONFIG.siteUrl}` } }
                            }
                        }
                    });
                    console.log("💬 تم إضافة التعليق بنجاح.");
                } catch (err) { console.log("⚠️ تعذر إضافة التعليق."); }
                */

                console.log("🚀 تم إنهاء العملية بنجاح.");
                return; 
            } else {
                console.log("✅ الحساب مراجع بالكامل ولا توجد فيديوهات جديدة.");
            }
        } catch (err) {
            console.error(`⚠️ مشكلة في الحساب ${account}:`, err.message);
        }
    }
}

startProfessionalAutomation();
