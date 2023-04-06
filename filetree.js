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
    // updated_at for cache ttl purposes
    try {
      this.#memory.set(key, { updated_at: Date.now(), list });
      this.setToLocalStorage()
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
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


// exports
export class FileTree {
  #root = null;
  #repository = null;
  #document = null;
  #token = null;

  constructor(document) {
    this.#document = document;
    this.#repository = new Repository();
    this.#init();
    this.load_page(window.location.pathname);
  }

  #init() {
    let bdiv = this.#document.getElementById("menu-container");
  
    if (!bdiv) {
      bdiv = this.#document.createElement("div");
      bdiv.setAttribute("id", "menu-container");
      this.#document.querySelector("body").append(bdiv);
      this.#root = bdiv;
    }
  }

  async load_page(url, flag) {
    try {
      const meta = get_filtree_meta(url);
      const list = await this.fetch_tree_list(meta);
      await this.embellish(list, meta, flag)
    } catch (error) {
      console.log();
    }
  }

  async load_new_page(url) {
    try {
      this.load_page(url, true);
    } catch (error) {
      throw new Error(error);
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
        this.#repository.set(label, data);
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
        if (!this.#repository.contains(label)) {
          list = await _fetch();
        } else {
          let cache = this.#repository.get(label);

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

  async embellish(list, meta, flag) {
    if(list)
      this.#root.innerHTML = menu_template(create_layout(list, meta));
  
    if(!flag) {
      this.#root.querySelector("#hamburger").classList.remove("loading");
      const hideMenu = () => {
        this.#root.querySelector("#list").classList.toggle("hidden");
      };
      this.#root.querySelectorAll("[data-list]").forEach((trigger) => {
        trigger.addEventListener("click", (e) => {
          trigger.nextElementSibling.classList.toggle("hidden");
        });
      });
      this.#root.querySelector("#hamburger").addEventListener("click", hideMenu);
      this.#root.querySelectorAll(".file-link").forEach((trigger) => {
        trigger.addEventListener("click", hideMenu);
      });
    }
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
  return cache?.updated_at && get_hours_between_now_and_time(cache?.updated_at) < CACHE_TTL;
}
