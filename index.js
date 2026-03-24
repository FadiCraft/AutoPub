const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

// --- 1. الإعدادات (Config) ---
const CONFIG = {
    youtube: {
        clientId: "80097892689-fatsck4rfg2n7g66ma33fm9jp24a3fes.apps.googleusercontent.com",
        clientSecret: "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",
        refreshToken: "1//04OySrfdvka32CgYIARAAGAQSNwF-L9IrDkZiwdv-6X0c9RfppP38Ngo-Rt0EW5TvZiNTJu3LvbI4VSIx_9NmS-DCaVVskB8yIhM"
    },
    brandName: "كيرو زوزو - Kiro Zozo",
    siteUrl: "https://redirectauto4kiro.blogspot.com/", // سيوضع في التعليق فقط
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

// --- 2. دوال الـ SEO والأمان ---

function buildSEODescription(title) {
    return `🎬 شاهد أجمل مقاطع الأفلام والمسلسلات الحصرية على قناة ${CONFIG.brandName}.\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `✨ نبذة عن المقطع:\n` +
           `${title}\n\n` +
           `🍿 إذا كنت تبحث عن مشاهدة الأفلام كاملة بجودة عالية، يمكنك البحث عن موقعنا الرسمي "كيرو زوزو" على جوجل.\n\n` +
           `💡 لا تنسى الاشتراك وتفعيل الجرس (🔔) لتصلك أحدث المقاطع اليومية.\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `🏷️ كلمات مفتاحية:\n` +
           `#كيرو_زوزو #kirozozo #أفلام #مشاهد_افلام #مسلسلات #Shorts #Movies #Trending #دراما #سينما`;
}

async function runSafetyCheck() {
    console.log("🛡️ فحص أمان القناة للفيديو السابق...");
    try {
        const searchRes = await youtube.search.list({ part: 'id', forMine: true, type: 'video', maxResults: 2, order: 'date' });
        const prevId = searchRes.data.items[1]?.id?.videoId;
        if (!prevId) return;

        const videoData = await youtube.videos.list({ part: 'status', id: prevId });
        if (videoData.data.items[0]?.status.uploadStatus === 'rejected') {
            console.log("⚠️ تم كشف مخالفة في الفيديو السابق، جاري الحذف...");
            await youtube.videos.delete({ id: prevId });
        }
    } catch (e) { console.log("ℹ️ الفحص تخطى لعدم وجود بيانات."); }
}

// --- 3. المحرك الرئيسي ---

async function startProfessionalAutomation() {
    let history = fs.existsSync(CONFIG.dbFile) ? JSON.parse(fs.readFileSync(CONFIG.dbFile)) : [];
    let videoPublished = false;

    console.log("🔄 بدء دورة البحث عن فيديوهات جديدة...");

    // المرور على الحسابات بالترتيب بدلاً من الاختيار العشوائي
    for (const account of CONFIG.tiktokAccounts) {
        console.log(`\n🔍 جاري البحث في حساب: ${account}`);

        try {
            // استخدام --flat-playlist لتسريع جلب الأيديهات فقط وبدون حد 20 فيديو
            // ملاحظة: إذا واجهت حظر، أضف: --cookies-from-browser chrome
            const ytDlpCmd = `yt-dlp --flat-playlist --get-id "${account}"`;
            let idsRaw = execSync(ytDlpCmd, { encoding: 'utf-8' });
            
            // تنظيف البيانات
            let allIds = idsRaw.trim().split('\n').filter(id => id.trim().length > 0);

            if (allIds.length === 0) {
                console.log("⚠️ لم يتم العثور على أي فيديوهات في هذا الحساب (قد يكون فارغاً أو محظوراً).");
                continue; // انتقل للحساب التالي
            }

            // تيك توك يعطي الفيديوهات من الأحدث للأقدم. نعكس المصفوفة لننشر من القديم للجديد (بالترتيب)
            allIds.reverse();

            // البحث عن أول فيديو غير منشور
            const nextId = allIds.find(id => !history.includes(id));

            if (!nextId) {
                console.log("✅ الحساب مكتمل بالكامل، جاري الانتقال للحساب التالي...");
                continue; // انتقل للحساب التالي في القائمة
            }

            console.log(`🚀 تم العثور على فيديو جديد! معالجة احترافية للمعرف: ${nextId}`);

            // 1. جلب العنوان
            let rawTitle = "مقطع حصري 🔥";
            try {
                rawTitle = execSync(`yt-dlp --get-title "https://www.tiktok.com/@any/video/${nextId}"`, { encoding: 'utf-8' }).trim().split('\n')[0];
            } catch (e) {
                console.log("⚠️ تعذر جلب العنوان الأصلي، سيتم استخدام عنوان افتراضي.");
            }
            let seoTitle = `${rawTitle.substring(0, 60)} 🔥 #كيرو_زوزو`;

            // 2. التحميل والمونتاج (تخطي الحقوق)
            console.log("📥 جاري التحميل من تيك توك...");
            execSync(`yt-dlp -f "bestvideo[height<=1080]+bestaudio/best" -o "input.mp4" "https://www.tiktok.com/@any/video/${nextId}"`);
            
            console.log("🎨 معالجة الفيديو تقنياً للمونتاج...");
            execSync(`ffmpeg -i input.mp4 -vf "scale=iw*1.25:ih*1.25,crop=iw/1.25:ih/1.25,eq=brightness=0.02:contrast=1.05" -map_metadata -1 -c:v libx264 -crf 21 -c:a aac -y output.mp4`);

            // 3. الرفع ليوتيوب
            console.log("📤 جاري الرفع إلى يوتيوب (بدون روابط في الوصف)...");
            const upload = await youtube.videos.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: {
                        title: seoTitle,
                        description: buildSEODescription(rawTitle),
                        tags: ['كيرو زوزو', 'kirozozo', 'أفلام', 'مسلسلات', 'Shorts', 'قصص افلام'],
                        categoryId: '24'
                    },
                    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
                },
                media: { body: fs.createReadStream('output.mp4') }
            });

            const newId = upload.data.id;
            console.log(`✅ نُشر بنجاح: https://youtu.be/${newId}`);

            // 4. تحديث قاعدة البيانات
            history.push(nextId);
            fs.writeFileSync(CONFIG.dbFile, JSON.stringify(history, null, 2));

            // 5. فحص الأمان للفيديو السابق
            await runSafetyCheck();

            // 6. إضافة التعليق المثبت بعد 3 دقائق
            console.log("⏳ الانتظار لمدة 3 دقائق قبل إضافة رابط الموقع في التعليقات (حماية من السبام)...");
            await delay(180000); 

            console.log("💬 إضافة التعليق التوجيهي...");
            const commentMsg = `🍿 لمشاهدة الفيلم كامل أو تحميله بجودة عالية، تفضل بزيارة موقعنا الرسمي من هنا:\n\n🔗 ${CONFIG.siteUrl}\n\n✨ استمتعوا بالمشاهدة ولا تنسوا الاشتراك في عائلة كيرو زوزو ❤️`;
            
            await youtube.commentThreads.insert({
                part: 'snippet',
                requestBody: {
                    snippet: {
                        videoId: newId,
                        topLevelComment: { snippet: { textOriginal: commentMsg } }
                    }
                }
            });
            console.log("🎯 اكتملت العملية بنجاح وبأقصى درجات الأمان.");

            // 7. إنهاء الحلقة (لأننا نريد نشر فيديو واحد فقط في كل مرة يعمل فيها السكريبت)
            videoPublished = true;
            break; 

        } catch (err) {
            console.error(`⚠️ خطأ في معالجة الحساب ${account}:`, err.message);
        } finally {
            // تنظيف الملفات المؤقتة بعد كل محاولة
            ['input.mp4', 'output.mp4'].forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f); });
        }
    }

    if (!videoPublished) {
        console.log("\n🏁 جميع الحسابات المضافة مكتملة بالكامل! لا يوجد أي فيديوهات جديدة للنشر.");
    }
}

// تشغيل البوت
startProfessionalAutomation();
