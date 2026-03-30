const STORAGE_KEYS = {
  posts: "pulse_plus_posts_v2",
  profile: "pulse_plus_profile_v1",
  notifications: "pulse_plus_notifications_v1",
  theme: "pulse_plus_theme"
};

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=60";

const state = {
  posts: readJSON(STORAGE_KEYS.posts, []),
  profile: readJSON(STORAGE_KEYS.profile, { name: "Anonymous", avatar: "", bio: "" }),
  notifications: readJSON(STORAGE_KEYS.notifications, []),
  showBookmarksOnly: false
};

const postForm = document.getElementById("postForm");
const contentInput = document.getElementById("content");
const imageUrlInput = document.getElementById("imageUrl");
const hashtagsInput = document.getElementById("hashtags");
const charCount = document.getElementById("charCount");
const feedEl = document.getElementById("feed");
const template = document.getElementById("postTemplate");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const showBookmarksBtn = document.getElementById("showBookmarks");
const clearAllBtn = document.getElementById("clearAll");
const profileSummary = document.getElementById("profileSummary");
const savedMiniList = document.getElementById("savedMiniList");
const trendingList = document.getElementById("trendingList");
const storiesList = document.getElementById("storiesList");
const refreshStoriesBtn = document.getElementById("refreshStories");
const themeToggleBtn = document.getElementById("themeToggle");
const notifCount = document.getElementById("notifCount");
const openNotificationsBtn = document.getElementById("openNotifications");
const notificationsDialog = document.getElementById("notificationsDialog");
const closeNotificationsBtn = document.getElementById("closeNotifications");
const notificationsList = document.getElementById("notificationsList");
const welcomeText = document.getElementById("welcomeText");

const profileForm = document.getElementById("profileForm");
const profileNameInput = document.getElementById("profileName");
const profileAvatarInput = document.getElementById("profileAvatar");
const profileBioInput = document.getElementById("profileBio");
const avatarPreview = document.getElementById("avatarPreview");
const namePreview = document.getElementById("namePreview");
const bioPreview = document.getElementById("bioPreview");

hydrateTheme();
hydrateProfileForm();
renderAll();

contentInput.addEventListener("input", () => {
  charCount.textContent = String(contentInput.value.length);
});

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.profile = {
    name: profileNameInput.value.trim() || "Anonymous",
    avatar: profileAvatarInput.value.trim(),
    bio: profileBioInput.value.trim()
  };
  writeJSON(STORAGE_KEYS.profile, state.profile);
  pushNotification("Profile updated.");
  renderProfile();
  renderStories();
  renderFeed();
});

postForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const content = contentInput.value.trim();
  if (!content) return;

  const hashtags = hashtagsInput.value
    .split(",")
    .map((tag) => normalizeTag(tag))
    .filter(Boolean);

  const post = {
    id: crypto.randomUUID(),
    author: state.profile.name,
    avatar: state.profile.avatar,
    content,
    imageUrl: imageUrlInput.value.trim(),
    hashtags,
    likes: 0,
    reposts: 0,
    comments: [],
    bookmarked: false,
    createdAt: Date.now()
  };

  state.posts.unshift(post);
  persistPosts();
  postForm.reset();
  charCount.textContent = "0";
  pushNotification("New post published.");
  renderAll();
});

searchInput.addEventListener("input", renderFeed);
sortSelect.addEventListener("change", renderFeed);

showBookmarksBtn.addEventListener("click", () => {
  state.showBookmarksOnly = !state.showBookmarksOnly;
  showBookmarksBtn.textContent = state.showBookmarksOnly ? "All Posts" : "Bookmarks";
  renderFeed();
});

clearAllBtn.addEventListener("click", () => {
  if (!state.posts.length) return;
  if (!window.confirm("Delete all posts permanently?")) return;
  state.posts = [];
  persistPosts();
  pushNotification("All posts deleted.");
  renderAll();
});

refreshStoriesBtn.addEventListener("click", renderStories);

themeToggleBtn.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light");
  localStorage.setItem(STORAGE_KEYS.theme, isLight ? "light" : "dark");
});

openNotificationsBtn.addEventListener("click", () => {
  notificationsDialog.showModal();
});

closeNotificationsBtn.addEventListener("click", () => {
  notificationsDialog.close();
});

function renderAll() {
  renderProfile();
  renderFeed();
  renderSummary();
  renderSavedMini();
  renderTrending();
  renderStories();
  renderNotifications();
}

function renderProfile() {
  namePreview.textContent = state.profile.name;
  bioPreview.textContent = state.profile.bio || "No bio yet.";
  avatarPreview.src = state.profile.avatar || FALLBACK_AVATAR;
  welcomeText.textContent = `Signed in as ${state.profile.name}`;
}

function renderFeed() {
  feedEl.innerHTML = "";

  const query = searchInput.value.trim().toLowerCase();
  const sorted = [...state.posts].sort(sorter(sortSelect.value));

  const filtered = sorted.filter((post) => {
    if (state.showBookmarksOnly && !post.bookmarked) return false;
    if (!query) return true;
    const target = [post.author, post.content, post.hashtags.join(" ")].join(" ").toLowerCase();
    return target.includes(query);
  });

  if (!filtered.length) {
    feedEl.innerHTML = `<li class="post">No posts found for current filters.</li>`;
    return;
  }

  for (const post of filtered) {
    const node = template.content.firstElementChild.cloneNode(true);

    node.querySelector(".post-author").textContent = post.author;
    node.querySelector(".post-time").textContent = new Date(post.createdAt).toLocaleString();
    node.querySelector(".post-content").textContent = post.content;

    const avatar = node.querySelector(".avatar.mini");
    avatar.src = post.avatar || FALLBACK_AVATAR;

    const image = node.querySelector(".post-image");
    if (post.imageUrl) {
      image.src = post.imageUrl;
      image.classList.remove("hidden");
    }

    const tagRow = node.querySelector(".tag-row");
    post.hashtags.forEach((tag) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = `#${tag}`;
      span.addEventListener("click", () => {
        searchInput.value = tag;
        renderFeed();
      });
      tagRow.appendChild(span);
    });

    const likeBtn = node.querySelector(".like-btn");
    likeBtn.querySelector("span").textContent = String(post.likes);
    likeBtn.addEventListener("click", () => {
      post.likes += 1;
      persistPosts();
      pushNotification(`Your post got a new like (${post.likes}).`);
      renderAll();
    });

    const repostBtn = node.querySelector(".repost-btn");
    repostBtn.querySelector("span").textContent = String(post.reposts);
    repostBtn.addEventListener("click", () => {
      post.reposts += 1;
      persistPosts();
      pushNotification("Your post was reposted.");
      renderAll();
    });

    const bookmarkBtn = node.querySelector(".bookmark-btn");
    bookmarkBtn.textContent = post.bookmarked ? "🔖 Saved" : "🔖 Save";
    bookmarkBtn.addEventListener("click", () => {
      post.bookmarked = !post.bookmarked;
      persistPosts();
      renderAll();
    });

    const commentToggle = node.querySelector(".comment-toggle");
    const commentForm = node.querySelector(".comment-form");
    commentToggle.addEventListener("click", () => commentForm.classList.toggle("hidden"));

    const commentsEl = node.querySelector(".comments");
    post.comments.forEach((comment) => commentsEl.appendChild(commentLi(comment)));

    commentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = commentForm.querySelector("input");
      const value = input.value.trim();
      if (!value) return;
      post.comments.push(value);
      persistPosts();
      pushNotification("New comment added.");
      renderAll();
    });

    const shareBtn = node.querySelector(".share-btn");
    shareBtn.addEventListener("click", async () => {
      const shareText = `${post.author}: ${post.content}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Pulse+ Post", text: shareText });
        } catch {
          // user canceled share
        }
      } else {
        await navigator.clipboard.writeText(shareText);
        pushNotification("Post copied to clipboard.");
      }
    });

    const editBtn = node.querySelector(".edit-btn");
    editBtn.addEventListener("click", () => {
      const updated = window.prompt("Edit your post", post.content);
      if (updated === null) return;
      const trimmed = updated.trim();
      if (!trimmed) return;
      post.content = trimmed;
      persistPosts();
      renderFeed();
    });

    const deleteBtn = node.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", () => {
      if (!window.confirm("Delete this post?")) return;
      state.posts = state.posts.filter((item) => item.id !== post.id);
      persistPosts();
      pushNotification("Post deleted.");
      renderAll();
    });

    feedEl.appendChild(node);
  }
}

function renderSummary() {
  const totals = state.posts.reduce(
    (acc, post) => {
      acc.likes += post.likes;
      acc.comments += post.comments.length;
      acc.reposts += post.reposts;
      return acc;
    },
    { likes: 0, comments: 0, reposts: 0 }
  );

  profileSummary.textContent = `Posts: ${state.posts.length}, Likes: ${totals.likes}, Comments: ${totals.comments}, Reposts: ${totals.reposts}.`;
}

function renderSavedMini() {
  savedMiniList.innerHTML = "";
  const saved = state.posts.filter((post) => post.bookmarked).slice(0, 5);
  if (!saved.length) {
    savedMiniList.innerHTML = "<li>No saved posts.</li>";
    return;
  }

  saved.forEach((post) => {
    const li = document.createElement("li");
    li.textContent = truncate(post.content, 56);
    savedMiniList.appendChild(li);
  });
}

function renderTrending() {
  trendingList.innerHTML = "";
  const counts = new Map();

  state.posts.forEach((post) => {
    post.hashtags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) {
    trendingList.innerHTML = "<li>No hashtags yet.</li>";
    return;
  }

  entries.forEach(([tag, count]) => {
    const li = document.createElement("li");
    li.innerHTML = `#${tag} <small>(${count})</small>`;
    li.addEventListener("click", () => {
      searchInput.value = tag;
      renderFeed();
    });
    trendingList.appendChild(li);
  });
}

function renderStories() {
  storiesList.innerHTML = "";
  const byAuthor = new Map();

  state.posts.forEach((post) => {
    if (!byAuthor.has(post.author)) byAuthor.set(post.author, post);
  });

  const stories = [...byAuthor.values()].slice(0, 10);
  if (!stories.length) {
    storiesList.innerHTML = "<li>No stories yet.</li>";
    return;
  }

  stories.forEach((story) => {
    const li = document.createElement("li");
    li.innerHTML = `<img class="avatar" src="${story.avatar || FALLBACK_AVATAR}" alt="${story.author}" /><small>${story.author}</small>`;
    li.title = truncate(story.content, 120);
    storiesList.appendChild(li);
  });
}

function renderNotifications() {
  notificationsList.innerHTML = "";
  const entries = state.notifications.slice(0, 20);
  notifCount.textContent = String(entries.length);

  if (!entries.length) {
    notificationsList.innerHTML = "<li>No notifications.</li>";
    return;
  }

  entries.forEach((message) => {
    const li = document.createElement("li");
    li.textContent = message;
    notificationsList.appendChild(li);
  });
}

function pushNotification(message) {
  state.notifications.unshift(`${new Date().toLocaleTimeString()} - ${message}`);
  state.notifications = state.notifications.slice(0, 30);
  writeJSON(STORAGE_KEYS.notifications, state.notifications);
  renderNotifications();
}

function hydrateTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === "light") document.body.classList.add("light");
}

function hydrateProfileForm() {
  profileNameInput.value = state.profile.name;
  profileAvatarInput.value = state.profile.avatar;
  profileBioInput.value = state.profile.bio;
}

function persistPosts() {
  writeJSON(STORAGE_KEYS.posts, state.posts);
}

function readJSON(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeTag(tag) {
  return tag.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "");
}

function sorter(mode) {
  const sorters = {
    newest: (a, b) => b.createdAt - a.createdAt,
    popular: (a, b) => b.likes - a.likes,
    comments: (a, b) => b.comments.length - a.comments.length
  };
  return sorters[mode] || sorters.newest;
}

function commentLi(text) {
  const li = document.createElement("li");
  li.textContent = text;
  return li;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
