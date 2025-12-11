import { test, expect } from '@playwright/test';
// Remova esta linha, ela não é necessária:
// import { TIMEOUT } from 'dns'; 

test('Demo Login Test 1', async({page,context}) =>{

    test.setTimeout(180000); // aumenta limite do teste
    // limpa sessão anterior para evitar problemas ao rodar várias vezes
    await context.clearCookies();
    await context.clearPermissions();
    
    await page.goto('https://sinan.saude.gov.br/sinan/login/login.jsf', { waitUntil: 'networkidle', timeout: 60000 }); // Aumente o timeout para 60 segundos
    // --- 2. Realizar login ---
    await page.locator('[id="form:username"]').fill('lucas.ferreira@sesma');
    await page.locator('[id="form:password"]').fill('lucas19');
    
    // Clica no botão de login, mas espera carregar a página
    await expect(page.locator('[name="form:j_id21"]')).toBeVisible();
    await page.locator('[name="form:j_id21"]').click();

    //<input type="submit" class="botao"></input>

    // Espera a página carregar após o login
    await page.waitForLoadState('domcontentloaded');
    
    // Exportação e Solicitar

    // Garante que o elemento esteja visível antes de prosseguir (seletor corrigido)
    await page.waitForSelector('[id="barraMenu:j_id52_span"]', { timeout: 30000 });
    await expect(page.locator('[id="barraMenu:j_id52_span"]')).toBeVisible();
    await page.locator('[id="barraMenu:j_id52_span"]').click();
    console.log('Login aceito...');

    
    await expect(page.locator('[id="barraMenu:j_id53:anchor"]')).toBeVisible();
    await page.locator('[id="barraMenu:j_id53:anchor"]').click();    

    // --- 3. Preencher Data Inicial e Data Final ---
    // Data inicial fixa
    await page.evaluate(() => {
    // nada aqui: executaremos com IDs específicos
    });

    // usar evaluate para setar o valor direto (mesmo que o campo seja um datepicker)
    await page.evaluate(() => {
        const el = document.getElementById('form:consulta_dataInicialInputDate');
        if (el) el.value = '01/01/2025';
    });

    // data final -> hoje
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const yyyy = hoje.getFullYear();
    const dataHojeStr = `${dd}/${mm}/${yyyy}`;

    await page.evaluate((valor) => {
        const el = document.getElementById('form:consulta_dataFinalInputDate');
        if (el) el.value = valor;
    }, dataHojeStr);
     
    // --- 4. Selecionar "Notificação ou Residência" no select com id 'form:tipoUf' ---
     await page.locator('[id="form:tipoUf"]').selectOption('3');
      // --- 5. exportar dados do paciente ---
     await page.locator('[name="form:j_id124"]').click();
     // --- 6. clicar em solicitar ---
     await page.locator('[id="form:j_id128"]').click();
     console.log('Solicitando dados...');

    // espera a mensagem de sucesso e captura o número
    // procurar por um span que contenha "Número:"
    const sucessoSpan = page.locator('xpath=//span[contains(text(), "Número:")]');
    await sucessoSpan.waitFor({ state: 'visible', timeout: 60000 });
    const numeroIdentificado = (await sucessoSpan.textContent()) || '';
    // limpar: "Número: 1.234"
    let numeroOriginal = numeroIdentificado.replace('Número:', '').trim();
    numeroOriginal = numeroOriginal.replace(/\./g, ''); // remover pontos caso existam

    console.log('Número da solicitação:', numeroOriginal);

    // --- 7. Ir para Menu Exportação -> Consultar exportação ---
    async function waitForNotBusy(timeout = 60000) {
        try {
            // espera o overlay/mascara ficar hidden (ajuste o seletor se necessário)
            await page.waitForSelector('#ajaxStatusMPDiv', { state: 'hidden', timeout });
        } catch (err) {
            // fallback: checa via função se o elemento existe e não bloqueia pointer-events
            await page.waitForFunction(() => {
                const el = document.querySelector('#ajaxStatusMPDiv') || document.querySelector('#ajaxStatusMPContainer');
                if (!el) return true;
                const s = window.getComputedStyle(el);
                return s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none' || el.getAttribute('aria-hidden') === 'true';
            }, { timeout }).catch(() => {});
        }
        // curto aguardo de rede para estabilidade
        try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch (e) { /* ignora */ }
    }

    await page.locator('[id="barraMenu:j_id52_span"]').click();
    await waitForNotBusy();
    await page.waitForSelector('[id="barraMenu:j_id56:anchor"]', { timeout: 10000 });
    await page.locator('[id="barraMenu:j_id56:anchor"]').click();
    await waitForNotBusy();

    // --- 8. Atualizar a listagem (clicar j_id101) duas vezes como no selenium ---
    const btnAtualizar = page.locator('[id="form:j_id101"]');
    await btnAtualizar.waitFor({ state: 'visible', timeout: 20000 });

    // 1ª atualização
    await waitForNotBusy();
    await btnAtualizar.click();
    await waitForNotBusy();

    // pequena espera para garantir que a atualização foi disparada no servidor
    await page.waitForTimeout(1000);

    // 2ª atualização
    await waitForNotBusy();
    await btnAtualizar.click();
    await waitForNotBusy();
    console.log('Atualizados...');


    // aguarda até que a tabela tenha pelo menos uma linha (ou até timeout)
    await page.waitForFunction(() => {
        const rows = document.querySelectorAll('table.rich-table tbody tr');
        return rows && rows.length > 0;
    }, { timeout: 30000 });

    // --- 9. Procurar na tabela pela linha com o número e clicar em "Baixar arquivo DBF" ---
    const linhas = page.locator('table.rich-table tbody tr');
    const count = await linhas.count();
    console.log(`linhas encontradas: ${count}`);

    let baixou = false;
    for (let i = 0; i < count; i++) {
        const linha = linhas.nth(i);
        // o número estava em td[1]/center no selenium
        const numeroElemento = linha.locator('xpath=./td[1]/center');
        const numeroLinha = (await numeroElemento.textContent())?.trim() || '';

        console.log(`➡️ Linha ${i}: ${numeroLinha}`);

        if (numeroLinha === numeroOriginal) {
            console.log(`✅ Número encontrado na linha ${i}. Iniciando download...`);
            // procurar o link "Baixar arquivo DBF" dentro dessa linha
            const linkBaixar = linha.locator('xpath=.//a[contains(text(), "Baixar arquivo DBF")]');
            await linkBaixar.waitFor({ state: 'visible', timeout: 10000 });
            // aguardar o evento de download
            const [ download ] = await Promise.all([
            page.waitForEvent('download', { timeout: 30000 }),
            linkBaixar.click()
            ]);

                // salvar o ZIP no workspace
            const fs = require('fs');
            const path = require('path');

            const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
            const outDir = path.join(workspace, 'sinan_downloads', String(numeroOriginal));
            fs.mkdirSync(outDir, { recursive: true });

            const suggested = download.suggestedFilename ? download.suggestedFilename() : `sinan_${numeroOriginal}.zip`;
            const zipPath = path.join(outDir, suggested);

            try {
                // saveAs é o método mais confiável para garantir que o arquivo vá para o destino
                await download.saveAs(zipPath);
            } catch (err) {
                // fallback: tentar copiar do caminho temporário
                const tmpPath = await download.path();
                if (tmpPath) {
                    fs.copyFileSync(tmpPath, zipPath);
                } else {
                    console.error('Erro ao salvar o download (saveAs e path falharam):', err);
                    throw err;
                }
            }

            console.log('✅ ZIP salvo em:', zipPath);
            console.log('Filename sugerido:', suggested);
            
            // Scrip para chamar python para extrair o zip --> testando
            const { execFileSync } = require('child_process');

            try {
                console.log('🔄 Convertendo DBF para CSV usando Python...');
                execFileSync('python', [
                    'convert_dbf_to_csv.py',
                    outDir
                ], { stdio: 'inherit' });
                console.log('✅ Conversão concluída!');
            } catch (err) {
                console.error('❌ Erro ao chamar o script Python:', err);
                throw err;
            }

            // listar apenas o arquivo salvo (para garantir visibilidade) --> testando
            const savedFiles = fs.readdirSync(outDir);
            console.log('Arquivos no diretório de download:', savedFiles);

            baixou = true;
            break;
        }
    }

    if (!baixou) {
            console.error(`❌ Erro: Solicitação ${numeroOriginal} não encontrada na lista.`);
            throw new Error('Solicitação não encontrada...');
    }
});