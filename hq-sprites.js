/**
 * HQ character sprites + turn-based motion (walk hop / attack lunge).
 * Magenta/pink studio background is keyed at load time.
 */
const CHAR_SCALE = 1.22;
const MOVE_ANIM_MS = 115;
const ENEMY_MOVE_ANIM_MS = 140;
const ATTACK_ANIM_MS = 220;
const ASSET_V = '4';
const av = (p) => p + '?v=' + ASSET_V;

const HQ_SPRITE_MANIFEST = {
    player: {
        idle: av('Assets/sprites/player.png'),
        views: {
            down: av('Assets/sprites/player.png'),
            up: av('Assets/sprites/player_back.png'),
            right: av('Assets/sprites/player_right.png'),
            left: av('Assets/sprites/player_right.png')
        }
    },
    enemy_slime: { idle: av('Assets/sprites/enemy_slime.png'), sheet: av('Assets/sprites/enemy_slime_sheet.png') },
    enemy_hagure_slime: { idle: av('Assets/sprites/enemy_hagure_slime.png'), sheet: av('Assets/sprites/enemy_hagure_slime_sheet.png') },
    enemy_goblin: { idle: av('Assets/sprites/enemy_goblin.png'), sheet: av('Assets/sprites/enemy_goblin_sheet.png') },
    enemy_skeleton: { idle: av('Assets/sprites/enemy_skeleton.png'), sheet: av('Assets/sprites/enemy_skeleton_sheet.png') },
    enemy_orc: { idle: av('Assets/sprites/enemy_orc.png'), sheet: av('Assets/sprites/enemy_orc_sheet.png') },
    enemy_werewolf: { idle: av('Assets/sprites/enemy_werewolf.png'), sheet: av('Assets/sprites/enemy_werewolf_sheet.png') },
    enemy_golem: { idle: av('Assets/sprites/enemy_golem.png'), sheet: av('Assets/sprites/enemy_golem_sheet.png') },
    enemy_dragon: { idle: av('Assets/sprites/enemy_dragon.png'), sheet: av('Assets/sprites/enemy_dragon_sheet.png') },
    enemy_boss_hedgehog: { idle: av('Assets/sprites/enemy_boss_hedgehog.png'), sheet: av('Assets/sprites/enemy_boss_hedgehog_sheet.png') },
    enemy_boss_adamantite: { idle: av('Assets/sprites/enemy_boss_adamantite.png'), sheet: av('Assets/sprites/enemy_boss_adamantite_sheet.png') },
    enemy_dark_moti: { idle: av('Assets/sprites/enemy_dark_moti.png') },
    enemy_creator: { idle: av('Assets/sprites/enemy_creator.png') },
    companion_omusubi: {
        idle: av('Assets/sprites/companion_omusubi.png'),
        sheet: av('Assets/sprites/companion_omusubi_sheet.png')
    },
    companion_patti: {
        idle: av('Assets/sprites/companion_patti.png'),
        sheet: av('Assets/sprites/companion_patti_sheet.png')
    }
};

const SpriteBank = {
    idle: {},
    views: {},
    sheets: {},
    ready: false,

    isChroma(r, g, b) {
        if (b > 90 && b > r + 28 && b > g + 28 && r < 130 && g < 150) return true;
        if (g > 140 && g > r + 35 && g > b + 35) return true;
        if (r >= 165 && b >= 120 && g < 175 && Math.abs(r - b) < 95 && (r - g) > 38) return true;
        return false;
    },

    cropCanvas(src) {
        try {
            const sctx = src.getContext('2d', { willReadFrequently: true });
            const w = src.width, h = src.height;
            const data = sctx.getImageData(0, 0, w, h).data;
            let minX = w, minY = h, maxX = 0, maxY = 0;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    if (data[(y * w + x) * 4 + 3] > 12) {
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (maxX <= minX || maxY <= minY) return src;
            const bw = maxX - minX + 1, bh = maxY - minY + 1;
            const pad = Math.ceil(Math.max(bw, bh) * 0.06);
            const side = Math.max(bw, bh) + pad * 2;
            const out = document.createElement('canvas');
            out.width = side;
            out.height = side;
            out.getContext('2d').drawImage(src, minX, minY, bw, bh, (side - bw) >> 1, side - bh - pad, bw, bh);
            return out;
        } catch (e) {
            return src;
        }
    },

    keyImage(img, crop = true) {
        try {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth || img.width;
            c.height = img.naturalHeight || img.height;
            if (!c.width || !c.height) return img;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, c.width, c.height);
            const px = data.data;
            const w = c.width, h = c.height;
            const corners = [0, (w - 1) * 4, ((h - 1) * w) * 4, ((h - 1) * w + w - 1) * 4];
            const preKeyed = corners.every((i) => px[i + 3] < 16);
            if (!preKeyed) {
                const n = w * h;
                const mag = new Uint8Array(n);
                for (let p = 0, i = 0; p < n; p++, i += 4) {
                    if (this.isChroma(px[i], px[i + 1], px[i + 2])) mag[p] = 1;
                }
                const vis = new Uint8Array(n);
                const q = [];
                const seeds = [0, w - 1, (h - 1) * w, (h - 1) * w + w - 1, (w >> 1), (h - 1) * w + (w >> 1)];
                for (const s of seeds) {
                    if (mag[s]) { vis[s] = 1; q.push(s); }
                }
                while (q.length) {
                    const i = q.pop();
                    const x = i % w, y = (i / w) | 0;
                    const neigh = [i - 1, i + 1, i - w, i + w];
                    for (const ni of neigh) {
                        if (ni < 0 || ni >= n) continue;
                        const nx = ni % w, ny = (ni / w) | 0;
                        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
                        if (!vis[ni] && mag[ni]) { vis[ni] = 1; q.push(ni); }
                    }
                }
                const dil = new Uint8Array(vis);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const i = y * w + x;
                        if (!vis[i]) continue;
                        if (x > 0) dil[i - 1] = 1;
                        if (x < w - 1) dil[i + 1] = 1;
                        if (y > 0) dil[i - w] = 1;
                        if (y < h - 1) dil[i + w] = 1;
                    }
                }
                for (let p = 0, i = 0; p < n; p++, i += 4) {
                    if (dil[p]) px[i + 3] = 0;
                }
            }
            ctx.putImageData(data, 0, 0);
            return crop ? this.cropCanvas(c) : c;
        } catch (e) {
            console.warn('SpriteBank.keyImage skipped', e);
            return img;
        }
    },

    loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    },

    async loadAll() {
        try {
            const jobs = [];
            for (const [key, def] of Object.entries(HQ_SPRITE_MANIFEST)) {
                jobs.push((async () => {
                    try {
                        const img = await this.loadImage(def.idle);
                        if (img) this.idle[key] = this.keyImage(img);
                        if (def.views) {
                            this.views[key] = {};
                            for (const [dir, src] of Object.entries(def.views)) {
                                const v = await this.loadImage(src);
                                if (v) this.views[key][dir] = this.keyImage(v);
                            }
                        }
                        if (def.sheet) {
                            const sh = await this.loadImage(def.sheet);
                            if (sh && sh.naturalWidth > 8) {
                                const keyed = this.keyImage(sh, false);
                                this.sheets[key] = { img: keyed, cols: 4, rows: 2, cell: (keyed.width / 4) | 0 };
                            }
                        }
                    } catch (e) {
                        console.warn('SpriteBank item failed', key, e);
                    }
                })());
            }
            await Promise.all(jobs);
        } catch (e) {
            console.warn('SpriteBank.loadAll', e);
        }
        this.ready = true;
    },

    dirFromFacing(faceDx, faceDy, named) {
        if (named) {
            if (named.indexOf('up') >= 0) return 'up';
            if (named.indexOf('down') >= 0) return 'down';
            if (named === 'left' || named.indexOf('left') >= 0) return 'left';
            if (named === 'right' || named.indexOf('right') >= 0) return 'right';
        }
        if (Math.abs(faceDx) >= Math.abs(faceDy)) {
            if (faceDx < 0) return 'left';
            if (faceDx > 0) return 'right';
        }
        if (faceDy < 0) return 'up';
        return 'down';
    },

    pickIdle(key, dir) {
        const views = this.views[key];
        if (views) {
            if (dir === 'up' && views.up) return views.up;
            if (dir === 'down' && views.down) return views.down;
            if ((dir === 'right' || dir === 'left') && views.right) return views.right;
        }
        return this.idle[key] || null;
    },

    /**
     * Draw a character into a tile cell, overflowing the tile (PMD-style).
     */
    draw(ctx, key, entity, px, py, tileW, tileH, now, extras) {
        extras = extras || {};
        const eSize = extras.size || 1;
        const canvas = this.pickIdle(key, this.dirFromFacing(entity.faceDx || 0, entity.faceDy || 1, entity.direction));
        const sheet = this.sheets[key];
        if (!canvas && !sheet) return false;

        const scale = eSize <= 1 ? CHAR_SCALE : (eSize === 2 ? 1.22 : 1.12);
        const drawW = tileW * eSize * scale;
        const drawH = tileH * eSize * scale;
        const dx = px + (tileW * eSize - drawW) / 2;
        const dy = py + tileH * eSize - drawH + Math.round(tileH * 0.06);

        const t = entity.animProgress ? entity.animProgress(now) : 0;
        const kind = entity.animKind || 'idle';
        let hop = 0, squashY = 1, squashX = 1, lungeX = 0, lungeY = 0;

        const hasSheet = !!(sheet && (kind === 'walk' || kind === 'attack'));
        if (kind === 'walk') {
            hop = Math.sin(t * Math.PI) * tileH * (hasSheet ? 0.10 : 0.16);
            const land = Math.sin(t * Math.PI);
            squashY = hasSheet ? 1 : (1 - land * 0.08);
            squashX = hasSheet ? 1 : (1 + land * 0.06);
        } else if (kind === 'attack') {
            // anticipation → strike → recover
            let lung = 0;
            if (t < 0.32) {
                lung = -0.18 * (t / 0.32);
                squashY = 1 - 0.12 * (t / 0.32);
                squashX = 1 + 0.10 * (t / 0.32);
            } else if (t < 0.55) {
                const u = (t - 0.32) / 0.23;
                lung = -0.18 + 0.72 * u;
                squashY = 0.88 + 0.18 * u;
                squashX = 1.10 - 0.16 * u;
            } else {
                const u = (t - 0.55) / 0.45;
                lung = 0.54 * (1 - u);
                squashY = 1.06 - 0.06 * u;
                squashX = 0.94 + 0.06 * u;
            }
            lungeX = (entity.lungeDx || 0) * lung * tileW;
            lungeY = (entity.lungeDy || 0) * lung * tileH;
        } else {
            hop = Math.sin((now || 0) / 380) * 1.1;
        }

        const dirName = (typeof entity.direction === 'string') ? entity.direction : '';
        const flip = (entity.faceDx || 0) < 0 || dirName === 'left' || dirName.indexOf('left') >= 0;
        ctx.save();
        if (extras.filter) ctx.filter = extras.filter;
        if (extras.alpha != null) ctx.globalAlpha = extras.alpha;

        const cx = dx + drawW / 2 + lungeX;
        const cy = dy + drawH + lungeY - hop;
        ctx.translate(cx, cy);
        ctx.scale((flip ? -1 : 1) * squashX, squashY);
        ctx.translate(-drawW / 2, -drawH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (sheet && (kind === 'walk' || kind === 'attack')) {
            const colCount = sheet.cols;
            const fi = Math.min(colCount - 1, Math.floor(t * colCount));
            const row = kind === 'attack' ? 1 : 0;
            const cell = sheet.cell;
            ctx.drawImage(sheet.img, fi * cell, row * cell, cell, cell, 0, 0, drawW, drawH);
        } else if (canvas) {
            ctx.drawImage(canvas, 0, 0, drawW, drawH);
        }

        ctx.restore();
        return true;
    }
};

function attachAnim(entity) {
    entity.animKind = 'idle';
    entity.animT0 = 0;
    entity.animDur = 0;
    entity.fromX = entity.x;
    entity.fromY = entity.y;
    entity.faceDx = 0;
    entity.faceDy = 1;
    entity.lungeDx = 0;
    entity.lungeDy = 0;
    entity._didAttack = false;
    return entity;
}

function startWalkFrom(entity, ox, oy, now, dur) {
    entity.fromX = ox;
    entity.fromY = oy;
    entity.animKind = 'walk';
    entity.animT0 = now;
    entity.animDur = dur || MOVE_ANIM_MS;
    entity.faceDx = Math.sign(entity.x - ox);
    entity.faceDy = Math.sign(entity.y - oy);
    if (entity.walkFrame != null) entity.walkFrame = (entity.walkFrame + 1) % 4;
}

function startAttackToward(entity, dx, dy, now) {
    entity.animKind = 'attack';
    entity.animT0 = now;
    entity.animDur = ATTACK_ANIM_MS;
    entity.lungeDx = Math.sign(dx) || 0;
    entity.lungeDy = Math.sign(dy) || 0;
    entity.faceDx = entity.lungeDx;
    entity.faceDy = entity.lungeDy;
}

function entityAnimProgress(entity, now) {
    if (!entity.animKind || entity.animKind === 'idle' || !entity.animDur) return 1;
    const t = (now - entity.animT0) / entity.animDur;
    if (t !== t) return 1;
    return Math.max(0, Math.min(1, t));
}

function entityIsAnimating(entity, now) {
    if (!entity.animKind || entity.animKind === 'idle' || !entity.animDur) return false;
    const elapsed = now - entity.animT0;
    if (elapsed !== elapsed) return false;
    if (elapsed < 0) return true;
    if (elapsed > entity.animDur + 250) return false;
    return elapsed < entity.animDur;
}

function entityVisualPos(entity, now) {
    const kind = entity.animKind || 'idle';
    if (kind === 'walk' && entity.animDur) {
        const t = Math.min(1, (now - entity.animT0) / entity.animDur);
        const e = 1 - (1 - t) * (1 - t);
        return {
            x: entity.fromX + (entity.x - entity.fromX) * e,
            y: entity.fromY + (entity.y - entity.fromY) * e
        };
    }
    return { x: entity.x, y: entity.y };
}

// Attach progress helper onto instances at draw time via prototype-free functions.
function bindAnimHelpers(entity) {
    entity.animProgress = (now) => entityAnimProgress(entity, now);
}
