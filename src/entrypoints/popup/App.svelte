<script lang="ts">
  import { onMount } from "svelte";
  import List from "./List.svelte";
  import Login from "./Login.svelte";

  let loading = true;
  let loggedIn = false;
  let loginStatus = "unlogin";
  let userVid = "";

  async function judgeIsLogin() {
    try {
      const response = await fetch("https://weread.qq.com/api/user/notebook", {
        credentials: "include",
      });
      const data = await response.json();

      const errCode = data?.data?.errcode;
      if (!errCode) {
        loggedIn = true;
        const first = data?.books?.[0]?.book;
        userVid = first?.userVid ?? "";
      } else {
        loggedIn = false;
        if (errCode === -2012) {
          loginStatus = "timeout";
        }
      }
    } catch (error) {
      console.error(error);
      loggedIn = false;
      loginStatus = "unlogin";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    judgeIsLogin();
  });
</script>

{#if loading}
  <div class="loading-wrap">
    <div class="mdui-spinner">
      <div class="mdui-spinner-layer">
        <div class="mdui-spinner-circle-clipper mdui-spinner-left"><div class="mdui-spinner-circle" /></div>
        <div class="mdui-spinner-gap-patch"><div class="mdui-spinner-circle" /></div>
        <div class="mdui-spinner-circle-clipper mdui-spinner-right"><div class="mdui-spinner-circle" /></div>
      </div>
    </div>
    <div class="loading-text">正在检查微信读书登录状态...</div>
  </div>
{:else}
  <div class="root-app">
    {#if loggedIn}
      <List {userVid} />
    {:else}
      <Login {loginStatus} />
    {/if}
  </div>
{/if}

<style>
  .root-app {
    min-width: 820px;
    min-height: 560px;
    background: linear-gradient(145deg, #f8fbff, #f3f7ff);
    padding: 16px;
    box-sizing: border-box;
  }

  .loading-wrap {
    min-width: 460px;
    min-height: 280px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: center;
    color: #334155;
    background: linear-gradient(145deg, #f8fbff, #f3f7ff);
  }

  .loading-text {
    font-size: 13px;
  }
</style>
