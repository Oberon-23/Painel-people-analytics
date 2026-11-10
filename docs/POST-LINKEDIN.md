# Post para o LinkedIn

Imagem: `docs/img/linkedin.png` (1200 × 1200). Os números são os do site publicado.

---

Hoje muita gente apresenta dados em HTML. E a pergunta que sempre aparece nos comentários é: e a segurança?

Montei um projeto para responder isso na prática: um painel de RH (turnover, absenteísmo, clima e igualdade salarial) de uma empresa fictícia, em que o banco de dados decide o que cada pessoa vê.

A mesma consulta, sem filtro nenhum, devolve:
→ 523 registros para a diretora de RH
→ 345 para o HR Business Partner (só a diretoria dele)
→ 158 para a gerente (só a equipe dela)
→ 0 para o analista (que só trabalha com números de grupos)

A tela não esconde nada. Ela simplesmente não recebe.

O que está por trás:
🔒 Linha: Row Level Security no PostgreSQL, e o aplicativo não enxerga nenhuma tabela, só funções
🔒 Coluna: salário e CPF só saem para quem pode, e o CPF sai mascarado
🔒 Grupo: médias de grupos com menos de 5 pessoas ficam ocultas, porque revelariam alguém (e o total não pode entregar o grupo escondido)
🔒 Rastro: não existe caminho para ler dados de pessoas sem deixar registro, e o aplicativo não consegue apagá-lo

E tem uma página que roda, ao vivo, 11 tentativas de burlar as regras: ler a tabela direto, trocar o usuário da sessão, apagar a auditoria... Todas barradas ou filtradas pelo banco.

O que levo para qualquer painel, seja em HTML ou em Power BI: segurança não é esconder coluna na tela. É decidir onde o dado fica e quem pode recebê-lo.

Stack: PostgreSQL, Next.js e TypeScript. Dados 100% fictícios.

🔗 Teste com os 4 perfis: https://painel-people-analytics.vercel.app
💻 Código: https://github.com/Oberon-23/painel-people-analytics

#PeopleAnalytics #LGPD #SegurancaDaInformacao #PostgreSQL #AnaliseDeDados
