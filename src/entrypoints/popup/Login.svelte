<script lang="ts">
  export let loginStatus = "unlogin";

  $: loginUrl = `https://weread.qq.com${loginStatus === "timeout" ? "" : "/#login"}`;
</script>

<div class="login-wrap">
  <div class="card">
    <h2>请先登录微信读书</h2>
    <p>
      {#if loginStatus === "timeout"}
        登录态已超时，请先刷新微信读书登录。
      {:else}
        需要登录后才能读取书籍和笔记。
      {/if}
    </p>
    <a href={loginUrl} target="_blank" rel="noreferrer">
      <button type="button">前往微信读书登录</button>
    </a>
  </div>
</div>

<style>
  .login-wrap {
    min-width: 620px;
    min-height: 380px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(145deg, #f8fbff, #f3f7ff);
  }

  .card {
    width: 420px;
    border-radius: 14px;
    border: 1px solid #d7e3f7;
    background: #ffffff;
    padding: 22px;
    text-align: center;
  }

  h2 {
    margin: 0 0 10px;
    font-size: 20px;
    color: #1f3252;
  }

  p {
    margin: 0 0 16px;
    color: #52627c;
    font-size: 14px;
    line-height: 1.45;
  }

  button {
    border: 0;
    border-radius: 10px;
    background: linear-gradient(120deg, #2563eb, #0ea5e9);
    color: #fff;
    font-weight: 600;
    padding: 10px 16px;
    cursor: pointer;
  }
</style>
