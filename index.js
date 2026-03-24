const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

const CONFIG = {
    youtube: {
        clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
        clientSecret: "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",
        refreshToken: "1//042s_C9epVc9rCgYIARAAGAQSNwF-L9IrjPshBrVUO_vfKgcR1pjWFwsCqRSJfb5pS3IGxIJvdsZI44aDB9HaCtd8wR6v_aPAd5o"
    },
    brandName: "كيرو زوزو - Kiro Zozo",
    siteUrl: "https://redirectauto4kiro.blogspot.com/",
    dbFile: 'history.json',
    tiktokAccounts: [
        'https://www.tiktok.com/@films2026_',
        'https://www.tiktok.com/@adeyu_77'
    ]
};

const oauth2Client = new google.auth.OAuth2(CONFIG.youtube.clientId, CONFIG.youtube.clientSecret);
oauth2Client.setCredentials({ refresh_token: CONFIG.youtube.refreshToken });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function buildSEODescription(title) {
    return `🎬 شاهد أجمل مقاطع الأفلام والمسلسلات الحصرية على قناة ${CONFIG.brandName}.\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `✨ نبذة عن المقطع:\n` +
           `${title}\n\n` +
           `🍿 للمزيد ابحث عن "كيرو زوزو" على جوجل.\n` +
           `💡 اشترك وفعل الجرس (🔔) ليصلك كل جديد.\n` +
           `#كيرو_زوزو #Shorts #Movies #Trending`;
}

async function startProfessionalAutomation() {
    let history = fs.existsSync(CONFIG.dbFile) ? JSON.parse(fs.readFileSync(CONFIG.dbFile)) : [];
    
    console.log("🔄 فحص الحسابات لنشر فيديو واحد فقط...");

    for (const account of CONFIG.tiktokAccounts) {
        console.log(`\n🔎 فحص الحساب: ${account}`);
        
        try {
            // جلب الأيديهات بدون حد معين (للبحث عن القديم)
            // ملاحظة: إذا توقف الجلب، استخدم: --cookies-from-browser chrome
            const idsRaw = execSync(`yt-dlp --flat-playlist --get-id "${account}"`, { encoding: 'utf-8' });
            let allIds = idsRaw.trim().split('\n').filter(id => id.trim().length > 0);

            if (allIds.length === 0) continue;

            // نعكس المصفوفة لنبدأ من أقدم فيديو في الحساب (بالترتيب)
            allIds.reverse();

            // العثور على أول فيديو لم يتم نشره مسبقاً
            const nextId = allIds.find(id => !history.includes(id));

            if (nextId) {
                console.log(`🎯 تم العثور على فيديو مستهدف: ${nextId}`);
                
                // 1. التحميل (بجودة 1080p كحد أقصى)
                execSync(`yt-dlp -f "bestvideo[height<=1080]+bestaudio/best" -o "input.mp4" "https://www.tiktok.com/@any/video/${nextId}"`);
                
                // 2. المونتاج (تغيير البصمة لتخطي حقوق يوتيوب)
                console.log("🎨 معالجة الفيديو تقنياً...");
                execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.1:ih*1.1,crop=iw/1.1:ih/1.1,eq=brightness=0.03:contrast=1.05" -map_metadata -1 -c:v libx264 -crf 20 -c:a aac -y output.mp4`);

                // 3. جلب العنوان الأصلي
                let rawTitle = "فيديو رائع";
                try { rawTitle = execSync(`yt-dlp --get-title "https://www.tiktok.com/@any/video/${nextId}"`, { encoding: 'utf-8' }).trim(); } catch(e){}

                // 4. الرفع إلى يوتيوب
                console.log("📤 جاري الرفع...");
                const upload = await youtube.videos.insert({
                    part: 'snippet,status',
                    requestBody: {
                        snippet: {
                            title: `${rawTitle.substring(0, 60)} 🔥 #كيرو_زوزو`,
                            description: buildSEODescription(rawTitle),
                            categoryId: '24'
                        },
                        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
                    },
                    media: { body: fs.createReadStream('output.mp4') }
                });

                const newId = upload.data.id;
                console.log(`✅ نُشر بنجاح: https://youtu.be/${newId}`);

                // 5. حفظ في السجل
                history.push(nextId);
                fs.writeFileSync(CONFIG.dbFile, JSON.stringify(history, null, 2));

                // 6. إضافة التعليق بعد انتظار 3 دقائق (اختياري للحماية)
                console.log("⏳ انتظار 1 دقائق للتعليق...");
                await delay(60000);
                await youtube.commentThreads.insert({
                    part: 'snippet',
                    requestBody: {
                        snippet: {
                            videoId: newId,
                            topLevelComment: { snippet: { textOriginal: `🍿 لمشاهدة الفيلم كامل زوروا موقعنا: ${CONFIG.siteUrl}` } }
                        }
                    }
                });

                console.log("🚀 تم نشر فيديو واحد بنجاح. إنهاء السكريبت.");
                return; // هذا الأمر سيخرج من الدالة بالكامل ويغلق السكريبت فوراً
            } else {
                console.log("✅ هذا الحساب تم نشر كل فيديوهاته، ننتقل للحساب التالي...");
            }
        } catch (err) {
            console.error(`⚠️ مشكلة في الحساب ${account}:`, err.message);
        }
    }
    console.log("🏁 لا يوجد فيديوهات جديدة في أي من الحسابات!");
}

startProfessionalAutomation();
