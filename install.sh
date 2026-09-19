#!/usr/bin/env bash
# ==============================================================================
# Script: install.sh
# Smart Installation & Build Script (Checks existing tools before installing)
# مغسلة عود ونظافة - نظام إدارة المغاسل المتكامل
# ==============================================================================

set -e

# Terminal formatting colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}     فحص البيئة وتثبيت وبناء المشروع على السيرفر الخاص              ${NC}"
echo -e "${BLUE}=====================================================================${NC}"

# Detect if sudo is needed
if [ "$EUID" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

# ------------------------------------------------------------------------------
# 1. Check Node.js (Existing on server - DO NOT REINSTALL)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[1/6] فحص بيئة Node.js الحالية على السيرفر...${NC}"
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE_VER=$(node -v)
  echo -e "${GREEN}✓ تم العثور على Node.js المثبت لديك: ${CURRENT_NODE_VER}${NC}"
else
  echo -e "${RED}❌ لم يتم العثور على أمر 'node' في مسار النظام PATH!${NC}"
  echo -e "${YELLOW}يرجى التأكد من مسار Node.js في السيرفر أو تفعيله في جلسة التيرمنال.${NC}"
  exit 1
fi

# ------------------------------------------------------------------------------
# 2. Check Package Manager (npm / bun / pnpm / yarn)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[2/6] فحص مدير الحزم المتاح (Package Manager)...${NC}"
PKG_MGR="npm"
if command -v npm >/dev/null 2>&1; then
  echo -e "${GREEN}✓ تم العثور على npm: $(npm -v)${NC}"
  PKG_MGR="npm"
elif command -v bun >/dev/null 2>&1; then
  echo -e "${GREEN}✓ تم العثور على Bun: $(bun -v)${NC}"
  PKG_MGR="bun"
elif command -v pnpm >/dev/null 2>&1; then
  echo -e "${GREEN}✓ تم العثور على pnpm: $(pnpm -v)${NC}"
  PKG_MGR="pnpm"
elif command -v yarn >/dev/null 2>&1; then
  echo -e "${GREEN}✓ تم العثور على Yarn: $(yarn -v)${NC}"
  PKG_MGR="yarn"
else
  echo -e "${RED}❌ لم يتم العثور على مدير حزم (npm)! يرجى التحقق من تثبيت npm مع Node.js.${NC}"
  exit 1
fi

# ------------------------------------------------------------------------------
# 3. Check System Tools (git, curl, build tools) - install only if missing
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[3/6] فحص الأدوات المساعدة للنظام...${NC}"
MISSING_TOOLS=()
for tool in git curl make gcc; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    MISSING_TOOLS+=("$tool")
  fi
done

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
  echo -e "${YELLOW}! الأدوات التالية غير موجودة وسيتم تثبيتها فقط: ${MISSING_TOOLS[*]}${NC}"
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update -y
    $SUDO apt-get install -y git curl build-essential
  elif command -v yum >/dev/null 2>&1; then
    $SUDO yum install -y git curl gcc gcc-c++ make
  fi
  echo -e "${GREEN}✓ تم استكمال الأدوات الناقصة.${NC}"
else
  echo -e "${GREEN}✓ جميع أدوات النظام الأساسية (git, curl, compiler) موجودة مسبقاً.${NC}"
fi

# ------------------------------------------------------------------------------
# 4. Check Process Manager (PM2) - install globally only if not exists
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[4/6] فحص مدير العمليات PM2...${NC}"
if command -v pm2 >/dev/null 2>&1; then
  echo -e "${GREEN}✓ PM2 مثبت مسبقاً على السيرفر: $(pm2 -v)${NC}"
else
  echo -e "${YELLOW}! PM2 غير مثبت. جاري تثبيته عالمياً عبر $PKG_MGR...${NC}"
  $SUDO npm install -g pm2
  echo -e "${GREEN}✓ تم تثبيت PM2 بنجاح.${NC}"
fi

# ------------------------------------------------------------------------------
# 5. Check Environment File (.env) and WhatsApp Storage Directory
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[5/6] فحص ملف الإعدادات ومجلدات التخزين...${NC}"
if [ -f .env ]; then
  echo -e "${GREEN}✓ ملف الإعدادات .env موجود مسبقاً.${NC}"
else
  echo -e "${YELLOW}! ملف .env غير موجود، يتم إنشاؤه من .env.example...${NC}"
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    cat << 'EOF' > .env
PORT=3000
NODE_ENV=production
GEMINI_API_KEY=
EOF
  fi
  echo -e "${GREEN}✓ تم تجهيز ملف .env.${NC}"
fi

# Ensure whatsapp_session and logs folders exist
mkdir -p whatsapp_session logs
chmod 755 whatsapp_session logs
echo -e "${GREEN}✓ مجلد جلسات الواتساب whatsapp_session وسجلات logs جاهزة.${NC}"

# ------------------------------------------------------------------------------
# 6. Install Project Dependencies & Build for Production
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[6/6] تثبيت حزم المشروع وبناؤه للإنتاج...${NC}"

# Check node_modules
if [ -d "node_modules" ]; then
  echo -e "${YELLOW}! مجلد node_modules موجود مسبقاً. جاري التحقق من تحديث الحزم...${NC}"
else
  echo -e "${BLUE}جاري تثبيت حزم المشروع لأول مرة عبر $PKG_MGR...${NC}"
fi

if [ "$PKG_MGR" = "npm" ]; then
  npm install
elif [ "$PKG_MGR" = "bun" ]; then
  bun install
elif [ "$PKG_MGR" = "pnpm" ]; then
  pnpm install
elif [ "$PKG_MGR" = "yarn" ]; then
  yarn install
fi
echo -e "${GREEN}✓ تم تجهيز كافة مكتبات المشروع بنجاح.${NC}"

# Building production assets
echo -e "\n${BLUE}جاري بناء المشروع للإنتاج (Vite + esbuild server.cjs)...${NC}"
if [ "$PKG_MGR" = "npm" ]; then
  npm run build
elif [ "$PKG_MGR" = "bun" ]; then
  bun run build
elif [ "$PKG_MGR" = "pnpm" ]; then
  pnpm run build
elif [ "$PKG_MGR" = "yarn" ]; then
  yarn build
fi

if [ ! -f "dist/server.cjs" ]; then
  echo -e "${RED}❌ تعذر العثور على dist/server.cjs بعد البناء! يرجى فحص سجل الأخطاء أعلاه.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ تم اكتمال بناء الواجهة والخادم بنجاح (dist/server.cjs جاهز)!${NC}"

# ------------------------------------------------------------------------------
# Start / Reload Application via PM2
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}تشغيل / تحديث التطبيق عبر PM2...${NC}"
if pm2 describe ghasil >/dev/null 2>&1 && pm2 describe laundry-app >/dev/null 2>&1; then
  echo -e "${YELLOW}! تم اكتشاف عملية مكررة 'laundry-app' مع وجود 'ghasil'. جاري إيقاف المكررة...${NC}"
  pm2 stop laundry-app || true
  pm2 delete laundry-app || true
fi

if pm2 describe ghasil >/dev/null 2>&1; then
  pm2 restart ghasil --update-env
elif pm2 describe laundry-app >/dev/null 2>&1; then
  pm2 restart laundry-app --update-env
elif [ -f ecosystem.config.cjs ]; then
  pm2 start ecosystem.config.cjs
else
  pm2 start dist/server.cjs --name "ghasil"
fi

pm2 save

echo -e "\n${GREEN}=====================================================================${NC}"
echo -e "${GREEN}🎉 تم بنجاح فحص البيئة وبناء وتشغيل المشروع على سيرفرك!               ${NC}"
echo -e "${GREEN}=====================================================================${NC}"
echo -e "رابط تشغيل النظام:"
echo -e "👉 ${BLUE}http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP'):3000${NC}"
echo -e "\nأوامر المراقبة السريعة:"
echo -e "  • ${YELLOW}pm2 status${NC}           : عرض حالة تشغيل التطبيق"
echo -e "  • ${YELLOW}pm2 logs laundry-app${NC} : عرض السجلات المباشرة"
echo -e "  • ${YELLOW}pm2 restart laundry-app${NC}: إعادة تشغيل الخادم"
echo -e "=====================================================================\n"
