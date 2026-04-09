const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

const CONFIG = {
    youtube: {
        clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
        clientSecret: "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",
        refreshToken: "1//04bliQUwOdwMJCgYIARAAGAQSNwF-L9IrVvkcfwwP4vrQ-7h2w3UQFvMjrq_1aYTO7uX28HuAVmTKuMDPuQ6vAvdK7LUP4CgvIEQ"
    },
    brandName: "كيرو زوزو - Kiro Zozo",
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

function buildSEODescription(title) {
    return `🎬 شاهد أجمل مقاطع الأفلام والمسلسلات الحصرية على قناة ${CONFIG.brandName}.\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `✨ نبذة عن المقطع:\n` +
           `${title}\n\n` +
           `🍿 للمزيد ابحث عن "كيرو زوزو" على جوجل.\n` +
           `💡 اشترك وفعل الجرس (🔔) ليصلك كل جديد.\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `#كيرو_زوزو #Shorts #Movies #Trending #أفلام #سينما`;
}

function generateTags(title) {
    const basicTags = ['كيرو زوزو', 'Kiro Zozo', 'أفلام', 'مسلسلات', 'Shorts', 'قصص افلام', 'دراما', 'ملخص أفلام'];
    const titleTags = title.split(' ').filter(word => word.length > 3).slice(0, 5);
    return [...new Set([...basicTags, ...titleTags])];
}

async function startProfessionalAutomation() {
    let history = fs.existsSync(CONFIG.dbFile) ? JSON.parse(fs.readFileSync(CONFIG.dbFile)) : [];
    
    console.log("🔄 فحص الحسابات لنشر فيديو واحد فقط...");

    for (const account of CONFIG.tiktokAccounts) {
        console.log(`\n🔎 فحص الحساب: ${account}`);
        
        try {
            // إضافة --impersonate chrome هنا لجلب القائمة بنجاح
            const idsRaw = execSync(`yt-dlp --impersonate chrome --flat-playlist --get-id "${account}"`, { encoding: 'utf-8' });
            let allIds = idsRaw.trim().split('\n').filter(id => id.trim().length > 0);

            if (allIds.length === 0) continue;

            allIds.reverse();
            const nextId = allIds.find(id => !history.includes(id));

            if (nextId) {
                console.log(`🎯 تم العثور على فيديو مستهدف: ${nextId}`);
                
                // 1. التحميل مع انتحال شخصية متصفح
                console.log("📥 جاري التحميل...");
                execSync(`yt-dlp --impersonate chrome -f "bestvideo[height<=1080]+bestaudio/best" -o "input.mp4" "https://www.tiktok.com/@any/video/${nextId}"`);
                
                // 2. المونتاج
                console.log("🎨 معالجة الفيديو تقنياً...");
                execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.1:ih*1.1,crop=iw/1.1:ih/1.1,eq=brightness=0.03:contrast=1.05" -map_metadata -1 -c:v libx264 -crf 20 -c:a aac -y output.mp4`);

                // 3. جلب العنوان مع انتحال الشخصية
                let rawTitle = "فيديو رائع";
                try { 
                    rawTitle = execSync(`yt-dlp --impersonate chrome --get-title "https://www.tiktok.com/@any/video/${nextId}"`, { encoding: 'utf-8' }).trim(); 
                } catch(e){}

                // 4. الرفع إلى يوتيوب
                console.log("📤 جاري الرفع إلى يوتيوب...");
                const upload = await youtube.videos.insert({
                    part: 'snippet,status',
                    requestBody: {
                        snippet: {
                            title: `${rawTitle.substring(0, 60)} 🔥 #كيرو_زوزو`,
                            description: buildSEODescription(rawTitle),
                            tags: generateTags(rawTitle),
                            categoryId: '24',
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

                // 6. التعليق التلقائي
                console.log("⏳ انتظار 1 دقيقة للتعليق...");
                await delay(60000);
                try {
                    await youtube.commentThreads.insert({
                        part: 'snippet',
                        requestBody: {
                            snippet: {
                                videoId: newId,
                                topLevelComment: { snippet: { textOriginal: `🍿 لمشاهده الأفلام والمسلسلات كامله زوروا موقعنا: ${CONFIG.siteUrl}` } }
                            }
                        }
                    });
                    console.log("💬 تم إضافة التعليق بنجاح.");
                } catch (err) { console.log("⚠️ تعذر إضافة التعليق."); }

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
