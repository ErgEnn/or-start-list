<script lang="ts">
  const alphabet = "ABCDEFGHIJKLMNOPQRSŠZŽ".split("");

  function scrollToLetter(letter: string) {
    // Placeholder for scroll functionality
    console.log("Scroll to:", letter);
  }
</script>

<aside class="alphabet-nav">
  <div class="nav-title">Quick Jump</div>
  {#each alphabet as letter}
    <button class="letter-btn" onclick={() => scrollToLetter(letter)}>
      {letter}
    </button>
  {/each}
</aside>

<style>
.alphabet-nav {
  background: #faf8f3;
  border-radius: 2px;
  padding: 1rem 0.5rem;
  box-shadow: 2px 2px 6px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(139,119,89,0.1);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border: 1px solid #d4c4a8;
}

.nav-title {
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
  margin-bottom: 0.5rem;
  color: #5a4a3a;
  writing-mode: horizontal-tb;
  font-family: 'Georgia', serif;
  letter-spacing: 0.5px;
}

.letter-btn {
  background: #f5f1e8;
  border: 1px solid #c9b896;
  border-radius: 1px;
  padding: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 44px;
  font-family: 'Georgia', serif;
  color: #4a3a2a;
}

.letter-btn:hover {
  background: #e8dcc4;
  color: #2a1a0a;
  border-color: #a89676;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.letter-btn:active {
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.15);
}
</style>
