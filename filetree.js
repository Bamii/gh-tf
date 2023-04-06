import * as _ from "./dompurify.js";
import * as morphdom from "./morphdom.esm.js";

// 10 HOURS.
const CACHE_TTL = 36000000;

// component templates...
// i did this because i didn't find a way to make react work with my current setup.
// i think this is better tho... no bloat.
const menu_template = (list) =>
  DOMPurify.sanitize(`
  <div class="menu">
    <div id="list" class="hidden">
      ${list}
    </div>
  </div>
  <div id="hamburger" class="menu">
    ===
  </div>
`);

const file_template = (link, item) =>
  DOMPurify.sanitize(`
  <div class="gh-file Box-row Box-row--focus-gray py-2 d-flex position-relative js-navigation-item navigation-focus">
    <a class="file-link" href="${link}">  ${item.name} </a>
  </div>
`);

const folder_template = (item) =>
  DOMPurify.sanitize(`
  <div data-list="${item.name}" class="folder Box-row Box-row--focus-gray py-2 d-flex position-relative js-navigation-item navigation-focus">
    ${item.name}
  </div>
`);

const folder_list_template = (item, list) =>
  DOMPurify.sanitize(`
  <div data-list-target="${item.name}" class="hidden folder-children">
    ${list}
  </div>
`);

const folder_container = (item, list) =>
  DOMPurify.sanitize(`
  <div>
    ${folder_template(item)}
    ${folder_list_template(item, list)}
  </div>
`);

// repository.
class Repository {
  #memory = new Map()

  constructor() {
    this.#memory = new Map(this.getFromLocalStorage());
  }

  getFromLocalStorage() {
    return localStorage.getItem("gh-filetree") ? new Map(JSON.parse(localStorage.getItem("gh-filetree"))) : null;
  }

  setToLocalStorage() {
    localStorage.setItem("gh-filetree", JSON.stringify(Array.from(this.#memory.entries())));
  }

  get(key) {
    return this.#memory.get(key);
  }

  contains(key) {
    return this.#memory.has(key);
  }

  set(key, list) {
    // updatedAt for cache purposes
    try {
      this.#memory.set(key, { updatedAt: Date.now(), list });
      this.setToLocalStorage()
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }
}

const repository = new Repository();

const fetch_tree_list = async (meta) => {
  const { owner, repo, tree, branch } = meta;
  const API = "https://6nhfujnue3.execute-api.us-east-1.amazonaws.com/";
  const label = create_memory_label({ owner, repo, tree, branch });

  const _fetch = async () => {
    try {
      const _data = await fetch(API, {
        method: "post",
        body: JSON.stringify({ owner, repo, branch }),
      });
      const { data } = await _data.json();
      repository.set(label, data);
      return data;
    } catch (error) {
      console.log(error)
      throw new Error(error)
    }
  }
 
  if (tree === "tree" || tree === "blob") {
    try {
      let list;
      // show_loading(true);
      if (!repository.contains(label)) {
        list = await _fetch();
      } else {
        let cache = repository.get(label);

        if(is_cache_valid(cache)) 
          list = cache.list;
        else
          list = await _fetch();
      }

      return list;
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  } else {
    return null;
  }
}

async function load_page(container, url, flag) {
  try {
    const meta = get_filtree_meta(url);
    const list = await fetch_tree_list(meta);
    await embellish(container, list, meta, flag)
  } catch (error) {
    console.log();
  }
}

async function embellish(container, list, meta, flag) {
  if(list)
    container.innerHTML = menu_template(create_layout(list, meta));

  if(!flag) {
    container.querySelector("#hamburger").classList.remove("loading");
    const hideMenu = () => {
      container.querySelector("#list").classList.toggle("hidden");
    };
    container.querySelectorAll("[data-list]").forEach((trigger) => {
      trigger.addEventListener("click", (e) => {
        trigger.nextElementSibling.classList.toggle("hidden");
      });
    });
    container.querySelector("#hamburger").addEventListener("click", hideMenu);
    container.querySelectorAll(".file-link").forEach((trigger) => {
      trigger.addEventListener("click", hideMenu);
    });
  }
}

const create_layout = (list, meta) => {
  const { owner, repo, branch } = meta;
  return list
    .map((item) => {
      switch (item.type) {
        case "file":
          return file_template(
            `https://github.com/${owner}/${repo}/blob/${branch}${item.path}/${item.name}`,
            item
          );

        case "folder":
          return folder_container(item, create_layout(item.children, meta));

        default:
          break;
      }
    })
    .join(" ");
};

class FileTree {
  #root = null;
  #repository = null;

  constructor() {
    this.#repository = new Repository();
    this.#init();
    this.load_page(this.#root, window.location.pathname);
  }

  #init() {
    let bdiv = _document.getElementById("menu-container");
  
    if (!bdiv) {
      bdiv = _document.createElement("div");
      bdiv.setAttribute("id", "menu-container");
      _document.querySelector("body").append(bdiv);
      this.#root = bdiv;
    }
  }

  async load_page(container, url, flag) {
    try {
      const meta = get_filtree_meta(url);
      const list = await fetch_tree_list(meta);
      await embellish(container, list, meta, flag)
    } catch (error) {
      console.log();
    }
  }

  
  async fetch_tree_list (meta) {
    const { owner, repo, tree, branch } = meta;
    const API = "https://6nhfujnue3.execute-api.us-east-1.amazonaws.com/";
    const label = create_memory_label(meta);

    const _fetch = async () => {
      try {
        const _data = await fetch(API, {
          method: "post",
          body: JSON.stringify({ owner, repo, branch }),
        });
        const { data } = await _data.json();
        repository.set(label, data);
        return data;
      } catch (error) {
        console.log(error)
        throw new Error(error)
      }
    }
  
    if (tree === "tree" || tree === "blob") {
      try {
        let list;
        // show_loading(true);
        if (!repository.contains(label)) {
          list = await _fetch();
        } else {
          let cache = repository.get(label);

          if(is_cache_valid(cache)) 
            list = cache.list;
          else
            list = await _fetch();
        }

        return list;
      } catch (error) {
        console.log(error);
        throw new Error(error);
      }
    } else {
      return null;
    }
  }
}

// exports
export async function load_new_page(url) {
  try {
    load_page(document.getElementById("menu-container"), url, true);
  } catch (error) {
    throw new Error(error);
  }
}

export default async function (_document) {
  try {
    let bdiv = _document.getElementById("menu-container");
  
    if (!bdiv) {
      bdiv = _document.createElement("div");
      bdiv.setAttribute("id", "menu-container");
      _document.querySelector("body").append(bdiv);
      
      load_page(bdiv, window.location.pathname);
    }
  } catch (error) {
    throw new Error(error);
  }
}

// utils
const get_filtree_meta = (pathname) => {
  const [, owner, repo, tree, branch] = pathname.split("/");
  return { owner, repo, tree, branch };
}

const create_memory_label = ({ owner, repo, tree, branch }) => {
  return `${owner}/${repo}/${branch}`;
}

const get_hours_between_time = (time1, time2) => {
  return Math.abs(time1 - time2);
}

const get_hours_between_now_and_time = (time) => {
  return get_hours_between_time(time, Date.now())
}

const is_cache_valid = (cache) => {
  return cache?.updatedAt && get_hours_between_now_and_time(cache?.updatedAt) < CACHE_TTL;
}