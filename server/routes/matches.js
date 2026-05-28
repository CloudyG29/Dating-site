router.post('/respond', async (req, res) => {
    const { uid, matchId, decision } = req.body; // decision: 'accept' | 'decline'
  
    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();
    const match = matchSnap.data();
  
    const isUser1 = match.user1 === uid;
    const updateField = isUser1 ? 'user1Accepted' : 'user2Accepted';
  
    if (decision === 'decline') {
      await matchRef.update({ status: 'declined' });
      // Re-queue both users for a new match
      await db.collection('users').doc(uid).update({ matchId: null });
      return res.json({ status: 'declined' });
    }
  
    await matchRef.update({ [updateField]: true });
  
    // Check if both accepted
    const updated = (await matchRef.get()).data();
    if (updated.user1Accepted && updated.user2Accepted) {
      await matchRef.update({ status: 'mutual' });
  
      // Fetch both user profiles for contact exchange
      const [u1Snap, u2Snap] = await Promise.all([
        db.collection('users').doc(match.user1).get(),
        db.collection('users').doc(match.user2).get(),
      ]);
  
      const u1 = u1Snap.data();
      const u2 = u2Snap.data();
  
      // Return the OTHER user's contact details to the requester
      const theirDetails = isUser1
        ? { handle: u2.handle, email: u2.email, phone: u2.phone, age: u2.age, location: u2.location }
        : { handle: u1.handle, email: u1.email, phone: u1.phone, age: u1.age, location: u1.location };
  
      // (Optional) Send email notifications via nodemailer here
  
      return res.json({ status: 'mutual', contact: theirDetails });
    }
  
    res.json({ status: 'waiting' }); // waiting for other party
  });