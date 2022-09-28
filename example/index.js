import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export const initMonaco = () => {
  const $root = document.getElementById('root');
  monaco.editor.create($root, {
    value: '// type your code...',
    language: 'json',
  });

  const $yaml = document.getElementById('yaml');
  monaco.editor.create($yaml, {
    value: '// type your yaml code...',
    language: 'yaml',
  });
};

// https://microsoft.github.io/monaco-editor/playground.html#extending-language-services-hover-provider-example
export const initMonacoHoverProvider = () => {
  monaco.languages.register({ id: 'mySpecialLanguage' });

  monaco.languages.registerHoverProvider('mySpecialLanguage', {
    provideHover: function (model, position) {
      return xhr('../index.html').then(function (res) {
        return {
          range: new monaco.Range(
            1,
            1,
            model.getLineCount(),
            model.getLineMaxColumn(model.getLineCount())
          ),
          contents: [
            { value: '**SOURCE**' },
            { value: '```html\n' + res.responseText.substring(0, 200) + '\n```' }
          ]
        };
      });
    }
  });

  monaco.editor.create(document.getElementById('container'), {
    value: '\n\nHover over this text',
    language: 'mySpecialLanguage'
  });

  function xhr(url) {
    var req = null;
    return new Promise(
      function (c, e) {
        req = new XMLHttpRequest();
        req.onreadystatechange = function () {
          if (req._canceled) {
            return;
          }

          if (req.readyState === 4) {
            if ((req.status >= 200 && req.status < 300) || req.status === 1223) {
              c(req);
            } else {
              e(req);
            }
            req.onreadystatechange = function () {};
          }
        };

        req.open('GET', url, true);
        req.responseType = '';

        req.send(null);
      },
      function () {
        req._canceled = true;
        req.abort();
      }
    );
  }

}