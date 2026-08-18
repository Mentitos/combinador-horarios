#!/usr/bin/env python3
"""
Servidor local ligero para el Combinador de Horarios Web.
Abre automáticamente el navegador en http://localhost:8000
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Habilitar CORS y caché para desarrollo fluido
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def main():
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)

    # Intentar puertos alternativos si el 8000 está ocupado
    for port in [8000, 8080, 8888, 3000, 5000]:
        try:
            httpd = socketserver.TCPServer(("", port), CustomHandler)
            url = f"http://localhost:{port}"
            print("=" * 60)
            print("  COMBINADOR DE HORARIOS - VERSIÓN WEB")
            print(f"  Servidor iniciado en: {url}")
            print("  Presioná Ctrl+C para detener el servidor.")
            print("=" * 60)

            # Abrir navegador automáticamente
            webbrowser.open(url)

            httpd.serve_forever()
            break
        except OSError:
            continue

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        sys.exit(0)
