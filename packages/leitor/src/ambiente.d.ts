// O empacotador (Vite) resolve "...?url" como a URL final do arquivo. Esta
// declaração ensina o TypeScript a entender esses imports fora do app.
declare module "*?url" {
  const url: string;
  export default url;
}
