import * as _ from "./dompurify.js";
import * as _morphdom from "./morphdom.esm.js";
const morphdom = _morphdom.default;

// 10 HOURS.
const CACHE_TTL = 36000000;

// component templates...
// i did this because i didn't find a way to make react work with my current setup.
// i think this is better tho... no bloat.
const menu_template = (list) =>
  DOMPurify.sanitize(`
  <div id="gh_ft_menu-container">
    <div class="list-container">
      <div id="list" class="hidden">
        ${list}
      </div>
    </div>
    <div id="hamburger" class="menu">
      ===
    </div>
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
      // console.log(error);
      throw new Error(error);
    }
  }
}

const create_layout = (list, meta = { owner:"", repo:"", branch:"" }) => {
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
  #options = null;

  constructor(document, options) {
    this.#options = options;
    this.#document = document;
    this.#repository = new Repository();
    this.#init();
    this.load_page(window.location.pathname);
  }

  #init() {
    console.log("init")
    let bdiv = this.#document.getElementById("gh_ft_menu-container");
  
    if (!bdiv) {
      bdiv = this.#document.createElement("div");
      bdiv.setAttribute("id", "gh_ft_menu-container");
      this.#document.querySelector("body").append(bdiv);
      this.#root = bdiv;
      
      morphdom(this.#root, menu_template(create_layout([])))
    }
  }

  loading(show) {
    this.#root.querySelector("#hamburger").classList.add("loading")
  }

  set_token(token) {
    this.#token = token;
  }

  async get_token() {
    this.#options.get_code();
    return new Promise((resolve, reject) => {
      const co = setInterval(() => {
        if(this.#token) clearInterval(co);
        resolve(this.#token);
      }, 50);
    })
  }

  async load_page(url, flag) {
    try {
      const meta = get_filtree_meta(url);
      const list = await this.fetch_tree_list(meta);
      await this.embellish(list, meta, flag)
    } catch (error) {
      // console.log();
    }
  }

  async load_new_page(_url) {
    try {
      // this.#root = this.#document.querySelector("#gh_ft_menu-container");
      const url = new URL(_url);
      this.load_page(url.pathname, true);
    } catch (error) {
      throw new Error(error);
    }
  }

  page_requires_filetree(tree) {
    if(!tree)
      return this.extract_branch_from_page();
    return tree === "tree" || tree === "blob";
  }

  extract_branch_from_page() {
    const branch_container = this.#document.querySelector("[data-hotkey='w']");
    if(branch_container) {
      return branch_container.querySelector("[data-menu-button]").innerText;
    }
    return false;
  }
  
  async fetch_tree_list (meta) {
    const { tree } = meta;
    const API = "https://6nhfujnue3.execute-api.us-east-1.amazonaws.com/";

    const _fetch = async (label, meta) => {
      // const token = await this.get_token();
      // console.log(token);
      try {
        const _data = await fetch(API, {
          method: "post",
          body: JSON.stringify({ ...meta }),
        });
        const { data } = await _data.json();
        this.#repository.set(label, data);
        return data;
      } catch (error) {
        // console.log(error)
        throw new Error(error)
      }
    }
  
    if (this.page_requires_filetree(tree)) {
      meta.branch = this.extract_branch_from_page();
      if(!meta.branch) return;

      meta.tree = "tree";
      let label = create_memory_label(meta);
      
      try {
        let list;
        this.loading(true);
        if (!this.#repository.contains(label)) {
          list = await _fetch(label, meta);
        } else {
          let cache = this.#repository.get(label);
          if(is_cache_valid(cache))
            list = cache.list;
          else
            list = await _fetch(label, meta);
        }

        this.loading(false);
        return list;
      } catch (error) {
        // console.log(error);
        throw new Error(error);
      }
    } else {
      console.log('nomem')
      return null;
    }
  }

  async embellish(list, meta, flag) {
    morphdom(this.#root, menu_template(create_layout(list ?? [], meta))) 
    this.#root.classList[list? "remove" : "add"]("hidden");

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
      return;
    } 
    
    this.#root.querySelector("#hamburger").classList.add("hidden");
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
