      const canViewFull = canViewFullPost(post, userId);

      const bodyText =
        canViewFull
          ? ((post.content && String(post.content).trim().length
              ? post.content
              : post.preview || "") || "")
          : (post.preview || "");

      if (caption) {
        if (bodyText && String(bodyText).trim().length) {
          caption.style.display = "block";
          caption.textContent = bodyText;
        } else {
          caption.style.display = "none";
        }
      }

      if (mediaBox) {
        const url = normalizeAssetUrl(post.media_url || "");
        const type = (post.media_type || "none").toLowerCase();

        mediaBox.innerHTML = "";

        if (!url || type === "none") {
          show(mediaBox, false);
        } else {
          show(mediaBox, true);

          const isVideo = isVideoMedia(type, url);

          if (!canViewFull && post.is_paid) {
            const creatorUrl = creatorProfileUrl(creatorUsername || "creator");
            const mediaEl = isVideo
              ? `<video playsinline preload="metadata" src="${esc(url)}"></video>`
              : `<img src="${esc(url)}" alt="Post media" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;

            mediaBox.innerHTML = `
              <div class="op-mediaWrap op-isLocked">
                ${mediaEl}
                <div class="op-lockOverlay">
                  <div class="op-lockBox">
                    <div class="op-badge op-badge--locked">Locked</div>
                    <p class="op-lockTitle">Premium post</p>
                    <p class="op-lockText">Subscribe to unlock this content</p>
                    <a class="op-openCreatorBtn" href="${esc(creatorUrl)}">Open creator</a>
                  </div>
                </div>
              </div>
            `;
          } else if (isVideo) {
            mediaBox.innerHTML = `<video controls playsinline preload="metadata" src="${esc(url)}"></video>`;
          } else {
            mediaBox.innerHTML = `<img src="${esc(url)}" alt="Post media" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
          }
        }
      }
