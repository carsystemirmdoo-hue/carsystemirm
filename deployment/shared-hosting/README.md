# Shared Hosting Deployment

Ova varijanta važi samo ako se kasnije kupi ili aktivira Burina/shared web hosting paket sa Apache podrškom.

Ne važi za Vercel.

## Rute

- Trenutni kod je namenjen Vercel deployment-u sa Next middleware zaštitom.
- Ako se kasnije vraća static/shared hosting varijanta, treba posebno definisati
  kako se zaključava pravi sajt, bez vraćanja stare `/preview` demo zone.

## Static export

Shared hosting bez Node servera zahteva statički export u `out/`.

Trenutna Vercel varijanta koristi Next middleware i nije namenjena statičkom exportu. Ako se projekat kasnije vraća na shared hosting, treba posebno vratiti static export konfiguraciju i proveriti da middleware nije deo tog deployment-a.

## Legacy Basic Auth primer

Primer fajla je:

```txt
deployment/shared-hosting/.htaccess.preview.example
```

Ovo je samo legacy primer za Apache folder zaštitu. Ne predstavlja trenutni
production flow. Ako se ponovo uvodi static preview folder, ovaj primer se
kasnije kopira u:

```txt
out/preview/.htaccess
```

U fajlu obavezno zameni:

```apache
/home/USERNAME/.htpasswd-carsystemrm
```

stvarnom apsolutnom putanjom na hostingu.

Pravi `.htpasswd` fajl mora biti van `public_html`, na primer:

```txt
/home/USERNAME/.htpasswd-carsystemrm
```

Stvarne lozinke se ne čuvaju u repo-u, ne ubacuju se u ZIP i ne uploaduju se u `public_html`.

Ako hosting panel ima opciju "Directory Privacy" ili "Password Protect Directories", bolje je koristiti tu opciju za budući zaštićeni folder, jer panel sam generiše ispravnu `.htaccess` i `.htpasswd` konfiguraciju.
